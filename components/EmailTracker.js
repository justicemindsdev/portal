import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { FiMail, FiEye, FiLink, FiClock, FiDownload, FiSend, FiInfo, FiChevronDown, FiChevronRight, FiCheck, FiX } from 'react-icons/fi';
import { MdLocationOn } from 'react-icons/md';
import supabase from '../utils/supabase';

const EmailTracker = ({ userId }) => {
  // State for tracking emails
  const [trackedEmails, setTrackedEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailStats, setEmailStats] = useState(null);
  
  // State for composing email
  const [showCompose, setShowCompose] = useState(false);
  const [newEmail, setNewEmail] = useState({
    to: '',
    subject: '',
    content: '',
    trackOpens: true,
    trackLinks: true,
    trackLocation: true
  });
  
  // State for Gmail connection
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [gmailUser, setGmailUser] = useState(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  
  // State for email sending
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState(null);
  
  // State for UI loading indicators
  const [loading, setLoading] = useState(false);
  
  // References
  const emailContentRef = useRef(null);
  
  // Load tracked emails
  useEffect(() => {
    if (userId) {
      fetchTrackedEmails();
      checkGmailConnection();
    }
  }, [userId]);

  // Check Gmail connection status
  const checkGmailConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'gmail')
        .single();
        
      if (data) {
        setIsGmailConnected(true);
        setGmailUser(data.email);
      }
    } catch (err) {
      console.error('Error checking Gmail connection:', err);
    }
  };

  // Fetch tracked emails
  const fetchTrackedEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('sender_id', userId)
        .order('sent_at', { ascending: false });
        
      if (!error) {
        setTrackedEmails(data || []);
      }
    } catch (err) {
      console.error('Error fetching tracked emails:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch email stats
  const fetchEmailStats = async (emailId) => {
    try {
      const { data, error } = await supabase
        .from('email_tracking_events')
        .select('*')
        .eq('email_id', emailId)
        .order('timestamp', { ascending: true });
        
      if (!error) {
        const stats = processEmailStats(data || []);
        setEmailStats(stats);
      }
    } catch (err) {
      console.error('Error fetching email stats:', err);
    }
  };

  // Process email stats from raw tracking events
  const processEmailStats = (events) => {
    // Group events by type
    const opens = events.filter(e => e.event_type === 'open');
    const clicks = events.filter(e => e.event_type === 'link_click');
    const locations = events.filter(e => e.event_type === 'location');
    
    // Calculate open statistics
    const firstOpen = opens.length > 0 ? opens[0] : null;
    const lastOpen = opens.length > 0 ? opens[opens.length - 1] : null;
    const totalOpens = opens.length;
    
    // Calculate unique opens (by IP address)
    const uniqueIps = new Set();
    opens.forEach(event => uniqueIps.add(event.ip_address));
    const uniqueOpens = uniqueIps.size;
    
    // Process link click data
    const linkClicksByUrl = {};
    clicks.forEach(click => {
      const url = click.metadata?.url || 'Unknown URL';
      if (!linkClicksByUrl[url]) {
        linkClicksByUrl[url] = { url, count: 0, timestamps: [] };
      }
      linkClicksByUrl[url].count++;
      linkClicksByUrl[url].timestamps.push(click.timestamp);
    });
    
    // Process location data
    const locationData = locations.map(loc => ({
      city: loc.metadata?.city || 'Unknown',
      country: loc.metadata?.country || 'Unknown',
      timestamp: loc.timestamp
    }));
    
    return {
      totalOpens,
      uniqueOpens,
      firstOpen,
      lastOpen,
      linkClicks: Object.values(linkClicksByUrl),
      locations: locationData,
      allEvents: events
    };
  };

  // Handle email selection
  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    fetchEmailStats(email.id);
  };

  // Handle sending a tracked email
  const handleSendEmail = async (e) => {
    e.preventDefault();
    
    if (!newEmail.to || !newEmail.subject || !newEmail.content.trim()) {
      setEmailError('Please complete all required fields');
      return;
    }
    
    setSendingEmail(true);
    setEmailError(null);
    
    try {
      // Generate a unique tracking ID
      const trackingId = `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      
      // Enhance email content with tracking elements
      const { enhancedContent, trackedLinks } = enhanceEmailContent(
        newEmail.content,
        trackingId,
        newEmail.trackLinks
      );
      
      // Send email through the API
      const sendResult = await fetch('/api/email/send-tracked', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: newEmail.to,
          subject: newEmail.subject,
          content: enhancedContent,
          trackingId,
          trackOpens: newEmail.trackOpens,
          trackLinks: newEmail.trackLinks,
          trackLocation: newEmail.trackLocation
        })
      });
      
      const sendResponse = await sendResult.json();
      
      if (!sendResult.ok) {
        throw new Error(sendResponse.message || 'Failed to send email');
      }
      
      // Save the email in our tracking database
      const { data, error } = await supabase
        .from('tracked_emails')
        .insert([
          {
            sender_id: userId,
            recipient: newEmail.to,
            subject: newEmail.subject,
            content: enhancedContent,
            tracking_id: trackingId,
            tracked_links: trackedLinks,
            track_opens: newEmail.trackOpens,
            track_links: newEmail.trackLinks,
            track_location: newEmail.trackLocation,
            sent_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Reset form and refresh tracked emails
      setNewEmail({
        to: '',
        subject: '',
        content: '',
        trackOpens: true,
        trackLinks: true,
        trackLocation: true
      });
      setShowCompose(false);
      fetchTrackedEmails();
      
    } catch (err) {
      console.error('Error sending tracked email:', err);
      setEmailError(err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  // Function to enhance email content with tracking elements
  const enhanceEmailContent = (content, trackingId, trackLinks) => {
    let enhancedContent = content;
    let trackedLinks = [];
    
    // Add tracking pixel for opens
    const trackingPixel = `<img src="${window.location.origin}/api/email/track-pixel/${trackingId}" width="1" height="1" style="display: none !important;" alt="">`;
    enhancedContent += trackingPixel;
    
    // Track links if enabled
    if (trackLinks) {
      // Simple regex to find links in HTML content (for demo)
      // In production, use a proper HTML parser
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>.*?<\/a>/gi;
      let match;
      
      // Replace links with tracked versions
      while ((match = linkRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const url = match[1];
        
        // Skip if already a tracking link or anchor
        if (url.includes('/api/email/track-link') || url.startsWith('#')) {
          continue;
        }
        
        const trackingUrl = `${window.location.origin}/api/email/track-link/${trackingId}?url=${encodeURIComponent(url)}`;
        
        // Store original link for analytics
        trackedLinks.push({
          original_url: url,
          tracking_url: trackingUrl
        });
        
        // Replace with tracking URL
        const newTag = fullTag.replace(url, trackingUrl);
        enhancedContent = enhancedContent.replace(fullTag, newTag);
      }
    }
    
    return { enhancedContent, trackedLinks };
  };

  // Connect to Gmail (for a real implementation)
  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      // In production, this would implement OAuth2 flow
      // Here we're just simulating it
      
      setTimeout(() => {
        setIsGmailConnected(true);
        setGmailUser('user@gmail.com');
        setConnectingGmail(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error connecting to Gmail:', error);
      setConnectingGmail(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate time ago
  const timeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <FiMail className="mr-2" /> Enhanced Email Tracking
        </h2>
        
        <div className="flex gap-2">
          {!isGmailConnected ? (
            <Button 
              onClick={handleConnectGmail}
              disabled={connectingGmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connectingGmail ? 'Connecting...' : 'Connect Gmail'}
            </Button>
          ) : (
            <>
              <div className="flex items-center text-green-500 mr-2">
                <FiCheck className="mr-1" />
                <span className="text-sm">{gmailUser}</span>
              </div>
              <Button
                onClick={() => setShowCompose(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <FiSend className="mr-1" /> New Tracked Email
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Email composition dialog */}
      {showCompose && (
        <Dialog open={showCompose} onOpenChange={setShowCompose}>
          <DialogContent className="sm:max-w-[800px] bg-[#1a1a1a] border-gray-700">
            <DialogHeader>
              <DialogTitle>Compose Tracked Email</DialogTitle>
              <DialogDescription>
                Create an email with enhanced tracking features
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSendEmail} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="email-to">To</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={newEmail.to}
                  onChange={e => setNewEmail({...newEmail, to: e.target.value})}
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
                  onChange={e => setNewEmail({...newEmail, subject: e.target.value})}
                  placeholder="Email subject"
                  className="bg-[#2d2d2d] border-gray-700"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email-content">Content</Label>
                <Textarea
                  id="email-content"
                  ref={emailContentRef}
                  value={newEmail.content}
                  onChange={e => setNewEmail({...newEmail, content: e.target.value})}
                  placeholder="Type your email content here..."
                  className="bg-[#2d2d2d] border-gray-700 min-h-[200px]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tracking Options</Label>
                
                <div className="flex space-x-4">
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      id="track-opens"
                      checked={newEmail.trackOpens}
                      onChange={() => setNewEmail({...newEmail, trackOpens: !newEmail.trackOpens})}
                      className="mr-2"
                    />
                    <label htmlFor="track-opens" className="flex items-center cursor-pointer">
                      <FiEye className="mr-1" /> Track Opens
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      id="track-links"
                      checked={newEmail.trackLinks}
                      onChange={() => setNewEmail({...newEmail, trackLinks: !newEmail.trackLinks})}
                      className="mr-2"
                    />
                    <label htmlFor="track-links" className="flex items-center cursor-pointer">
                      <FiLink className="mr-1" /> Track Links
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      id="track-location"
                      checked={newEmail.trackLocation}
                      onChange={() => setNewEmail({...newEmail, trackLocation: !newEmail.trackLocation})}
                      className="mr-2"
                    />
                    <label htmlFor="track-location" className="flex items-center cursor-pointer">
                      <MdLocationOn className="mr-1" /> Track Location
                    </label>
                  </div>
                </div>
              </div>
              
              {emailError && (
                <div className="bg-red-900 bg-opacity-20 border border-red-800 text-red-100 px-4 py-2 rounded">
                  {emailError}
                </div>
              )}
              
              <DialogFooter className="gap-2 pt-2">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompose(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendingEmail}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendingEmail ? 'Sending...' : 'Send Tracked Email'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Main content area with tracked emails and stats */}
      <div className="flex space-x-4">
        {/* Left side - Email List */}
        <div className={`${selectedEmail ? 'w-1/2' : 'w-full'}`}>
          <h3 className="text-lg font-medium mb-3">Your Tracked Emails</h3>
          
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading tracked emails...</div>
          ) : trackedEmails.length === 0 ? (
            <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
              <FiMail size={40} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">No tracked emails yet</p>
              <Button 
                onClick={() => setShowCompose(true)}
                disabled={!isGmailConnected}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FiSend className="mr-2" />
                {isGmailConnected ? 'Send Your First Tracked Email' : 'Connect Gmail to Start'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {trackedEmails.map(email => (
                <div 
                  key={email.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedEmail?.id === email.id 
                      ? 'bg-[#252525] border-blue-600' 
                      : 'border-gray-700 hover:bg-[#222]'
                  }`}
                  onClick={() => handleSelectEmail(email)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-white truncate">{email.subject}</h4>
                      <p className="text-gray-400 text-sm truncate">To: {email.recipient}</p>
                    </div>
                    
                    {email.opened_at && (
                      <span className="text-green-500 flex items-center text-sm ml-2">
                        <FiEye className="mr-1" /> 
                        {email.open_count > 1 ? `${email.open_count}x` : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{timeAgo(email.sent_at)}</span>
                    
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
        
        {/* Right side - Email Stats */}
        {selectedEmail && (
          <div className="w-1/2 border-l border-gray-700 pl-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium">Email Analytics</h3>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEmail(null)}
              >
                <FiX />
              </Button>
            </div>
            
            <div className="bg-[#252525] p-3 rounded-lg mb-4">
              <h4 className="font-medium">{selectedEmail.subject}</h4>
              <p className="text-gray-400 text-sm">To: {selectedEmail.recipient}</p>
              <p className="text-gray-500 text-xs mt-1">Sent: {formatDate(selectedEmail.sent_at)}</p>
            </div>
            
            {!emailStats ? (
              <div className="text-center py-6 text-gray-400">Loading tracking data...</div>
            ) : (
              <div className="space-y-4">
                {/* Open statistics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#252525] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-500">{emailStats.totalOpens || 0}</div>
                    <div className="text-gray-400 text-sm">Total Opens</div>
                  </div>
                  
                  <div className="bg-[#252525] p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-500">{emailStats.uniqueOpens || 0}</div>
                    <div className="text-gray-400 text-sm">Unique Opens</div>
                  </div>
                </div>
                
                {/* First and last open stats */}
                {emailStats.firstOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-[#252525] p-3 rounded-lg">
                      <h5 className="text-sm text-gray-400 mb-1">First Opened</h5>
                      <p className="text-white">{formatDate(emailStats.firstOpen.timestamp)}</p>
                    </div>
                    
                    {emailStats.lastOpen && emailStats.totalOpens > 1 && (
                      <div className="bg-[#252525] p-3 rounded-lg">
                        <h5 className="text-sm text-gray-400 mb-1">Last Opened</h5>
                        <p className="text-white">{formatDate(emailStats.lastOpen.timestamp)}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Link click data */}
                {emailStats.linkClicks && emailStats.linkClicks.length > 0 && (
                  <div className="bg-[#252525] p-3 rounded-lg">
                    <h5 className="text-sm text-gray-400 mb-2">Link Clicks</h5>
                    
                    {emailStats.linkClicks.map((link, i) => (
                      <div key={i} className="mb-2 pb-2 border-b border-gray-700 last:border-0">
                        <div className="flex items-center">
                          <FiLink className="mr-2 text-blue-400 flex-shrink-0" />
                          <span className="text-sm text-white truncate">{link.url}</span>
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-gray-400">
                          <span>Clicks: {link.count}</span>
                          <span>Last: {formatDate(link.timestamps[link.timestamps.length - 1])}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Location data */}
                {emailStats.locations && emailStats.locations.length > 0 && (
                  <div className="bg-[#252525] p-3 rounded-lg">
                    <h5 className="text-sm text-gray-400 mb-2">Locations</h5>
                    
                    {emailStats.locations.map((loc, i) => (
                      <div key={i} className="flex items-center mb-1 last:mb-0">
                        <MdLocationOn className="mr-1 text-red-400" />
                        <span className="text-sm">{loc.city}, {loc.country}</span>
                        <span className="ml-auto text-xs text-gray-500">{timeAgo(loc.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No activity message */}
                {emailStats.totalOpens === 0 && (
                  <div className="bg-[#252525] p-4 rounded-lg text-center">
                    <p className="text-gray-400">No activity detected yet</p>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(`mailto:${selectedEmail.recipient}?subject=Re: ${selectedEmail.subject}`)}
                  >
                    <FiSend className="mr-2" /> Follow Up
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      // In a real app, would generate and download a CSV/PDF report
                      alert('Analytics export feature would be implemented here');
                    }}
                  >
                    <FiDownload className="mr-2" /> Export Stats
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

export default EmailTracker;
