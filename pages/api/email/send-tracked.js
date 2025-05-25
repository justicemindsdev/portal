import { createTransport } from 'nodemailer';
import supabase from '../../../utils/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, content, trackingId, trackOpens, trackLinks, trackLocation } = req.body;

  // Validate required fields
  if (!to || !subject || !content || !trackingId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the user's email credentials - in a real app, you'd have these securely stored
    const { data: credentials, error: credError } = await supabase
      .from('email_connections')
      .select('*')
      .eq('user_id', req.body.userId || 'default')
      .eq('provider', 'gmail')
      .single();

    if (credError) {
      console.error('Error fetching email credentials:', credError);
      return res.status(500).json({ error: 'Failed to fetch email credentials' });
    }

    // Configure transporter
    let transporter;
    
    // In production, you'd use the actual Gmail OAuth flow
    // For this demo, we'll use a simple configuration
    transporter = createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // This would be an app-specific password
      }
    });

    // Send the email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: content,
      headers: {
        'X-Tracking-ID': trackingId,
        'X-Track-Opens': trackOpens ? 'true' : 'false',
        'X-Track-Links': trackLinks ? 'true' : 'false',
        'X-Track-Location': trackLocation ? 'true' : 'false'
      }
    });

    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId,
      trackingId
    });

  } catch (error) {
    console.error('Error sending tracked email:', error);
    return res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message 
    });
  }
}
