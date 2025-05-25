import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { FiInfo, FiMail, FiCheckCircle, FiX } from "react-icons/fi";
import supabase from "../utils/supabase";

const GmailIntegration = ({ userId, onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credentials, setCredentials] = useState(null);

  // Check if user already has Gmail connection
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase
          .from("email_connections")
          .select("*")
          .eq("user_id", userId)
          .eq("provider", "gmail")
          .single();
        
        if (error) {
          console.error("Error checking connection:", error);
          return;
        }
        
        if (data) {
          setIsConnected(true);
          setEmail(data.email);
          setCredentials({
            email: data.email,
            // We don't store or retrieve the actual password for security reasons
            hasPassword: true
          });
          if (onConnectionChange) {
            onConnectionChange(true, data.email);
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      }
    };
    
    checkExistingConnection();
  }, [userId]);

  const handleConnect = async (e) => {
    e.preventDefault();
    
    if (!email || !appPassword) {
      setError("Email and App Password are required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 1. Test SMTP connection with provided credentials
      const testConnection = await fetch('/api/gmail/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          appPassword
        }),
      });
      
      const result = await testConnection.json();
      
      if (!testConnection.ok) {
        throw new Error(result.message || "Failed to connect to Gmail");
      }
      
      // 2. Save connection details to database (encrypted)
      const { error } = await supabase
        .from("email_connections")
        .upsert([
          {
            user_id: userId,
            provider: "gmail",
            email: email,
            // Store encrypted app password or reference in secure storage
            // This is a simplified version - in production, you'd need to handle this securely
            credentials_reference: result.credentialsId,
            connected_at: new Date().toISOString()
          }
        ]);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // 3. Update state
      setIsConnected(true);
      setCredentials({
        email,
        hasPassword: true
      });
      
      // Wipe sensitive data
      setPassword("");
      setAppPassword("");
      
      if (onConnectionChange) {
        onConnectionChange(true, email);
      }
      
    } catch (err) {
      console.error("Connection error:", err);
      setError(err.message || "Could not connect to Gmail. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect your Gmail account?")) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Remove from database
      const { error } = await supabase
        .from("email_connections")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "gmail");
        
      if (error) {
        throw new Error(error.message);
      }
      
      // Reset state
      setIsConnected(false);
      setCredentials(null);
      
      if (onConnectionChange) {
        onConnectionChange(false, null);
      }
      
    } catch (err) {
      console.error("Disconnect error:", err);
      setError(err.message || "Could not disconnect Gmail account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <FiMail className="mr-2" /> Gmail Integration
        </h3>
        {isConnected && (
          <div className="flex items-center text-green-500">
            <FiCheckCircle className="mr-1" />
            <span className="text-sm">Connected</span>
          </div>
        )}
      </div>
      
      {isConnected ? (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-400">Connected to Gmail as:</p>
            <p className="text-white">{credentials?.email}</p>
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Processing..." : "Disconnect"}
            </Button>
            <Button
              onClick={() => window.open("https://mail.google.com", "_blank")}
              variant="outline"
            >
              Open Gmail
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Gmail Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@gmail.com"
                className="bg-[#2d2d2d] border-gray-700"
              />
            </div>
            
            <div>
              <div className="flex justify-between">
                <Label htmlFor="app-password">App Password</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-gray-400 cursor-help">
                        <FiInfo size={16} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        An App Password is a 16-character code that gives our app permission to access your Gmail. 
                        You can generate one in your Google Account security settings.
                      </p>
                      <a 
                        href="https://myaccount.google.com/apppasswords" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 underline mt-2 block"
                      >
                        Generate App Password
                      </a>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="app-password"
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                placeholder="16-character app password"
                className="bg-[#2d2d2d] border-gray-700"
              />
              <p className="text-xs text-gray-400 mt-1">
                Never use your main Google password. Create an App Password specifically for this application.
              </p>
            </div>
            
            {error && (
              <div className="bg-red-900 bg-opacity-30 border border-red-800 text-red-200 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={loading || !email || !appPassword}
              className="w-full"
            >
              {loading ? "Connecting..." : "Connect Gmail Account"}
            </Button>
            
            <p className="text-xs text-gray-400">
              Your credentials are securely stored and only used for sending emails on your behalf.
              We never store your main Google password.
            </p>
          </div>
        </form>
      )}
    </div>
  );
};

export default GmailIntegration;
