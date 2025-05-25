import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { FiActivity, FiEye, FiCheckCircle, FiLink, FiBarChart2, FiClock } from 'react-icons/fi';
import { MdLocationOn } from 'react-icons/md';
import supabase from '../utils/supabase';

const MailTracking = ({ userId, isAdmin }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [newEmail, setNewEmail] = useState({
    to: '',
    subject: '',
    content: '',
    trackOpens: true,
    trackLinks: true,
    trackLocation: true
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showNewEmailForm, setShowNewEmailForm] = useState(false);
  const [emailStats, setEmailStats] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchTrackedEmails();
    }
  }, [userId]);

  const fetchTrackedEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('sender_id', userId)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching tracked emails:', error);
      } else {
        setEmails(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailStats = async (emailId) => {
    try {
      const { data, error } = await supabase
        .from('email_tracking_events')
        .select('*')
        .eq('email_id', emailId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching email stats:', error);
      } else {
        // Process events data for display
        const stats = processTrackingEvents(data || []);
        setEmailStats(stats);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const processTrackingEvents = (events) => {
    // Group events by type
    const openEvents = events.filter(event => event.event_type === 'open');
    const linkEvents = events.filter(event => event.event_type === 'link_click');
    const locationEvents = events.filter(event => event.event_type === 'location');

    // Determine first and last open
    const firstOpen = openEvents.length > 0 ? openEvents[0] : null;
    const lastOpen = openEvents.length > 0 ? openEvents[openEvents.length - 1] : null;
    
    // Calculate total opens
    const totalOpens = openEvents.length;
    
    // Calculate unique opens by IP
    const uniqueIPs = new Set(openEvents.map(event => event.ip_address));
    const uniqueOpens = uniqueIPs.size;
    
    // Determine unique locations
    const locations = locationEvents.map(event => {
      return {
        city: event.metadata?.city || 'Unknown',
        country: event.metadata?.country || 'Unknown',
        timestamp: event.timestamp
      };
    });

    // Calculate link click statistics
    const linkClicks = linkEvents.reduce((acc, event) => {
      const url = event.metadata?.url || 'Unknown Link';
      if (!acc[url]) {
        acc[url] = {
          url,
          clicks: 0,
          timestamps: []
        };
      }
      acc[url].clicks++;
      acc[url].timestamps.push(event.timestamp);
      return acc;
    }, {});

    // Convert to array for easier rendering
    const linkClickArray = Object.values(linkClicks);

    return {
      totalOpens,
      uniqueOpens,
      firstOpen,
      lastOpen,
      locations,
      linkClicks: linkClickArray,
      allEvents: events
    };
  };

  const handleViewEmail = (email) => {
    setSelectedEmail(email);
    fetchEmailStats(email.id);
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    
    if (!newEmail.to || !newEmail.subject || !newEmail.content) {
      alert('Please fill all required fields');
      return;
    }
    
    setSendingEmail(true);
    
    try {
      // Generate a tracking ID for this email
      const trackingId = generateTrackingId();
      
      // Insert tracking pixels and tracked links if enabled
      const { enhancedContent, trackedLinks } = enhanceEmailContent(
        newEmail.content,
        trackingId,
        newEmail.trackLinks
      );
      
      // Store email in database
      const { data, error } = await supabase
        .from('tracked_emails')
        .insert([
          {
            sender_id: userId,
            recipient: newEmail.to,
            subject: newEmail.subject,
            content: enhancedContent,
            tracking_id: trackingId,
            track_opens: newEmail.trackOpens,
            track_links: newEmail.trackLinks,
            track_location: newEmail.trackLocation,
            tracked_links: trackedLinks,
            sent_at: new Date().toISOString()
          }
        ])
        .select();
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Send the email (this would integrate with your email sending service)
      // For now, we'll simulate a successful send
      await simulateEmailSend(newEmail.to, newEmail.subject, enhancedContent);
      
      // Reset form and refresh email list
      setNewEmail({
        to: '',
        subject: '',
        content: '',
        trackOpens: true,
        trackLinks: true,
        trackLocation: true
      });
      
      setShowNewEmailForm(false);
      fetchTrackedEmails();
      
      alert('Email sent successfully!');
      
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  // Utility functions for tracking
  const generateTrackingId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const enhanceEmailContent = (content, trackingId, trackLinks) => {
    let enhancedContent = content;
    const trackedLinks = [];
    
    // Add tracking pixel for open tracking
    const trackingPixel = `<img src="${window.location.origin}/api/email-tracking/pixel/${trackingId}" width="1" height="1" alt="" style="display:none">`;
    enhancedContent += trackingPixel;
    
    // Replace links with tracked versions if enabled
    if (trackLinks) {
      // Simple regex to find links - in a real app you would use a more robust parser
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(https?:\/\/[^"']+)\1/g;
      let match;
      
      while ((match = linkRegex.exec(content)) !== null) {
        const originalUrl = match[2];
        const trackingUrl = `${window.location.origin}/api/email-tracking/redirect/${trackingId}?url=${encodeURIComponent(originalUrl)}`;
        
        trackedLinks.push({
          original_url: originalUrl,
          tracking_url: trackingUrl
        });
        
        // Replace the original URL with the tracking URL
        enhancedContent = enhancedContent.replace(
          new RegExp(`href=(["'])${escapeRegExp(originalUrl)}\\1`, 'g'),
          `href="${ trackingUrl }"`
        );
      }
    }
    
    return { enhancedContent, trackedLinks };
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const simulateEmailSend = async (to, subject, content) => {
    // In a real implementation, this would send the email via your mail service
    console.log(`Simulating sending email to ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content (first 100 chars): ${content.substring(0, 100)}...`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return true;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold flex items-center">
          <FiActivity className="mr-2" /> Enhanced Mail Tracking
        </h2>
        
        <Button 
          onClick={() => setShowNewEmailForm(!showNewEmailForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {showNewEmailForm ? "Cancel" : "Track New Email"}
        </Button>
      </div>
      
      {showNewEmailForm && (
        <div className="mb-6 p-4 border border-gray-700 rounded-lg">
          <h3 className="text-lg font-medium mb-4">New Tracked Email</h3>
          
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div>
              <Label htmlFor="email-to">Recipient</Label>
              <Input
                id="email-to"
                type="email"
                value={newEmail.to}
                onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
                placeholder="recipient@example.com"
                className="bg-[#2d2d2d] border-gray-700"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                type="text"
                value={newEmail.subject}
                onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                placeholder="Email subject"
                className="bg-[#2d2d2d] border-gray-700"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="email-content">Content</Label>
              <Textarea
                id="email-content"
                value={newEmail.content}
                onChange={(e) => setNewEmail({ ...newEmail, content: e.target.value })}
                placeholder="Email content (supports HTML)"
                className="bg-[#2d2d2d] border-gray-700 min-h-[150px]"
                required
              />
            </div>
            
            <div className="flex flex-col space-y-2">
              <h4 className="text-sm font-medium">Tracking Options</h4>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="track-opens"
                  checked={newEmail.trackOpens}
                  onChange={(e) => setNewEmail({ ...newEmail, trackOpens: e.target.checked })}
                  className="mr-2"
                />
                <Label htmlFor="track-opens" className="cursor-pointer">
                  <FiEye className="inline mr-1" /> Track Opens
                </Label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="track-links"
                  checked={newEmail.trackLinks}
                  onChange={(e) => setNewEmail({ ...newEmail, trackLinks: e.target.checked })}
                  className="mr-2"
                />
                <Label htmlFor="track-links" className="cursor-pointer">
                  <FiLink className="inline mr-1" /> Track Link Clicks
                </Label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="track-location"
                  checked={newEmail.trackLocation}
                  onChange={(e) => setNewEmail({ ...newEmail, trackLocation: e.target.checked })}
                  className="mr-2"
                />
                <Label htmlFor="track-location" className="cursor-pointer">
                  <MdLocationOn className="inline mr-1" /> Track Location
                </Label>
              </div>
            </div>
            
            <div className="pt-2">
              <Button 
                type="submit" 
                disabled={sendingEmail}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {sendingEmail ? "Sending..." : "Send Tracked Email"}
              </Button>
            </div>
          </form>
        </div>
      )}
      
      <div className="flex space-x-4">
        <div className={`${selectedEmail ? 'w-1/2' : 'w-full'}`}>
          <h3 className="text-lg font-medium mb-3">Your Tracked Emails</h3>
          
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400">No tracked emails yet</p>
              <Button 
                onClick={() => setShowNewEmailForm(true)} 
                variant="outline"
                className="mt-2"
              >
                Send your first tracked email
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {emails.map((email) => (
                <div 
                  key={email.id} 
                  className={`p-3 border border-gray-700 rounded-lg cursor-pointer hover:bg-[#252525] transition-colors ${selectedEmail?.id === email.id ? 'bg-[#252525] border-blue-600' : ''}`}
                  onClick={() => handleViewEmail(email)}
                >
                  <div className="flex justify-between">
                    <h4 className="font-medium text-white truncate">{email.subject}</h4>
                    {email.opened_at && (
                      <span className="text-green-500 flex items-center text-sm">
                        <FiEye className="mr-1" /> Opened
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-400 text-sm truncate">To: {email.recipient}</p>
                  
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{formatDate(email.sent_at)}</span>
                    
                    <div className="flex space-x-2">
                      {email.track_opens && <FiEye title="Tracking opens" />}
                      {email.track_links && <FiLink title="Tracking links" />}
                      {email.track_location && <MdLocationOn title="Tracking location" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {selectedEmail && (
          <div className="w-1/2 border-l border-gray-700 pl-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Email Details</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedEmail(null)}
              >
                Close
              </Button>
            </div>
            
            <div className="bg-[#252525] p-3 rounded-lg mb-4">
              <h4 className="font-medium">{selectedEmail.subject}</h4>
              <p className="text-gray-400 text-sm">To: {selectedEmail.recipient}</p>
              <p className="text-gray-400 text-sm">Sent: {formatDate(selectedEmail.sent_at)}</p>
            </div>
            
            {!emailStats ? (
              <p className="text-gray-400 text-center py-4">Loading tracking data...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#252525] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-500">{emailStats.totalOpens}</div>
                    <div className="text-gray-400 text-sm">Total Opens</div>
                  </div>
                  
                  <div className="bg-[#252525] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-500">{emailStats.uniqueOpens}</div>
                    <div className="text-gray-400 text-sm">Unique Opens</div>
                  </div>
                </div>
                
                {emailStats.firstOpen && (
                  <div className="bg-[#252525] p-3 rounded-lg">
                    <h5 className="text-sm text-gray-400 flex items-center mb-1">
                      <FiClock className="mr-1" /> First Opened
                    </h5>
                    <p className="text-white">{formatDate(emailStats.firstOpen.timestamp)}</p>
                    {emailStats.firstOpen.metadata?.city && (
                      <p className="text-gray-400 text-sm flex items-center mt-1">
                        <MdLocationOn className="mr-1" />
                        {emailStats.firstOpen.metadata?.city}, {emailStats.firstOpen.metadata?.country}
                      </p>
                    )}
                  </div>
                )}
                
                {emailStats.linkClicks.length > 0 && (
                  <div className="bg-[#252525] p-3 rounded-lg">
                    <h5 className="text-sm text-gray-400 flex items-center mb-2">
                      <FiLink className="mr-1" /> Link Clicks
                    </h5>
                    
                    {emailStats.linkClicks.map((link, index) => (
                      <div key={index} className="mb-2 pb-2 border-b border-gray-700 last:border-0 last:mb-0 last:pb-0">
                        <p className="text-sm text-white truncate">{link.url}</p>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>Clicks: {link.clicks}</span>
                          <span>First: {formatDate(link.timestamps[0])}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {emailStats.locations.length > 0 && (
                  <div className="bg-[#252525] p-3 rounded-lg">
                    <h5 className="text-sm text-gray-400 flex items-center mb-2">
                      <MdLocationOn className="mr-1" /> Locations
                    </h5>
                    
                    {emailStats.locations.map((location, index) => (
                      <div key={index} className="mb-1 text-sm">
                        <span className="text-white">{location.city}, {location.country}</span>
                        <span className="text-gray-500 text-xs ml-2">
                          {formatDate(location.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="pt-2">
                  <Button
                    onClick={() => window.open(`/email-analytics/${selectedEmail.id}`, '_blank')}
                    className="w-full"
                    variant="outline"
                  >
                    <FiBarChart2 className="mr-1" /> View Full Analytics
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MailTracking;
