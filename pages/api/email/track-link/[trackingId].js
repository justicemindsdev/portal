import supabase from '../../../../utils/supabase';

export default async function handler(req, res) {
  try {
    // Extract tracking ID from the URL path
    const { trackingId } = req.query;
    
    // Get the original URL from the query parameter
    const { url } = req.query;
    
    if (!trackingId || !url) {
      return res.status(400).json({ error: 'Missing tracking ID or URL' });
    }
    
    // Extract useful information from the request
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.socket.remoteAddress || 
                     'Unknown';
    const referer = req.headers['referer'] || 'Unknown';
    
    // Get the email associated with this tracking ID
    const { data: emailData, error: emailError } = await supabase
      .from('tracked_emails')
      .select('id, sender_id, track_location')
      .eq('tracking_id', trackingId)
      .single();
    
    if (emailError || !emailData) {
      console.error('Email not found for tracking ID:', trackingId);
      // Redirect to the original URL anyway to avoid breaking the user experience
      return res.redirect(url);
    }
    
    // Get approximate location from IP if location tracking is enabled
    let locationData = null;
    if (emailData.track_location) {
      locationData = await getLocationFromIP(ipAddress);
    }
    
    // Record the link click event
    const { error: eventError } = await supabase
      .from('email_tracking_events')
      .insert([
        {
          email_id: emailData.id,
          event_type: 'link_click',
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referer,
          metadata: {
            url: url,
            ...(locationData ? {
              city: locationData.city,
              country: locationData.country,
              coordinates: locationData.coordinates
            } : {})
          },
          timestamp: new Date().toISOString()
        }
      ]);
    
    if (eventError) {
      console.error('Error recording link click event:', eventError);
    }
    
    // If this is the first activity for this email, update opened_at
    const { error: updateError } = await supabase
      .from('tracked_emails')
      .update({ 
        opened_at: new Date().toISOString() 
      })
      .eq('id', emailData.id)
      .is('opened_at', null);
    
    if (updateError) {
      console.error('Error updating email opened status:', updateError);
    }
    
    // Finally, redirect the user to the original URL
    return res.redirect(url);
    
  } catch (error) {
    console.error('Error processing link tracking:', error);
    
    // If there's an error, redirect to the original URL if it exists
    if (req.query.url) {
      return res.redirect(req.query.url);
    }
    
    // Otherwise return a generic error
    return res.status(500).json({ error: 'Failed to process link' });
  }
}

// Simplified location lookup function (same as in track-pixel)
// In production, you would use a proper IP geolocation service
async function getLocationFromIP(ip) {
  // For demo purposes, return a random location
  const locations = [
    { 
      city: 'New York', 
      country: 'United States',
      coordinates: { lat: 40.7128, lng: -74.006 }
    },
    { 
      city: 'London', 
      country: 'United Kingdom',
      coordinates: { lat: 51.5074, lng: -0.1278 }
    },
    { 
      city: 'Tokyo', 
      country: 'Japan',
      coordinates: { lat: 35.6762, lng: 139.6503 }
    },
    { 
      city: 'Sydney', 
      country: 'Australia',
      coordinates: { lat: -33.8688, lng: 151.2093 }
    },
    { 
      city: 'San Francisco', 
      country: 'United States',
      coordinates: { lat: 37.7749, lng: -122.4194 }
    }
  ];
  
  return locations[Math.floor(Math.random() * locations.length)];
}
