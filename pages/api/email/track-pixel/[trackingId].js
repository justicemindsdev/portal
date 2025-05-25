import supabase from '../../../../utils/supabase';

export default async function handler(req, res) {
  // Set headers for a transparent 1x1 GIF
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Create a 1x1 transparent GIF - this is the tracking pixel
  const transparentPixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 
    'base64'
  );

  try {
    // Extract tracking ID from the URL path
    const { trackingId } = req.query;
    
    if (!trackingId) {
      // Still return the pixel even if there's no tracking ID to avoid errors
      return res.status(200).send(transparentPixel);
    }
    
    // Extract useful information from the request
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.socket.remoteAddress || 
                     'Unknown';
    const referer = req.headers['referer'] || 'Unknown';
    
    // Get the email ID associated with this tracking ID
    const { data: emailData, error: emailError } = await supabase
      .from('tracked_emails')
      .select('id, sender_id, track_location')
      .eq('tracking_id', trackingId)
      .single();
    
    if (emailError || !emailData) {
      console.error('Email not found for tracking:', trackingId);
      return res.status(200).send(transparentPixel);
    }
    
    // Get approximate location from IP (simplified for demo)
    let locationData = null;
    if (emailData.track_location) {
      locationData = await getLocationFromIP(ipAddress);
    }
    
    // Record the open event
    const { error: eventError } = await supabase
      .from('email_tracking_events')
      .insert([
        {
          email_id: emailData.id,
          event_type: 'open',
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referer,
          metadata: locationData ? {
            city: locationData.city,
            country: locationData.country,
            coordinates: locationData.coordinates
          } : null,
          timestamp: new Date().toISOString()
        }
      ]);
    
    if (eventError) {
      console.error('Error recording tracking event:', eventError);
    }
    
    // Update email's opened status if this is the first open
    const { error: updateError } = await supabase
      .from('tracked_emails')
      .update({ 
        opened_at: new Date().toISOString(),
        open_count: supabase.rpc('increment', { x: 1 }) // Requires a custom function in Supabase
      })
      .eq('id', emailData.id)
      .is('opened_at', null); // Only update if it hasn't been opened before
    
    if (updateError) {
      console.error('Error updating email opened status:', updateError);
    }
    
  } catch (error) {
    console.error('Error processing tracking pixel:', error);
  }
  
  // Always return the pixel, even if there was an error
  return res.status(200).send(transparentPixel);
}

// Simplified location lookup function
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
