"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Mail, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function CalendarSettings() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if calendar is already connected
    const checkConnection = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/calendar/status');
        const data = await response.json();
        setIsConnected(data.connected);
      } catch (error) {
        console.error('Error checking calendar connection:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkConnection();
  }, []);

  const handleConnect = async (type: 'google' | 'secondary-google' | 'outlook') => {
    try {
      const endpoint = type === 'outlook' 
        ? '/api/calendar/outlook/auth' 
        : '/api/calendar/auth';
      
      const response = await fetch(endpoint, {
        method: 'GET',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(`Error connecting to ${type} calendar:`, error);
    }
  };

  const handleDisconnect = async () => {
    try {
      // Set loading state
      setIsLoading(true);
      
      // Make API request to disconnect calendar
      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include authorization if needed
          ...(user?.email && { 'Authorization': `Bearer ${user.email}` })
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Calendar disconnected:', data);
        setIsConnected(false);
      } else {
        console.error('Failed to disconnect calendar:', await response.text());
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10 max-w-3xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-2xl font-semibold mb-3">Calendar Integration</h2>
        <p className="text-muted-foreground mb-8 text-base">
          Connect your calendar to automatically join scheduled meetings and generate transcripts.
        </p>

        <div className="grid gap-6">
          <motion.div 
            className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{user?.email}</h3>
                    <div className="text-sm text-muted-foreground flex items-center mt-1">
                      <span className="flex items-center">
                        Google Calendar
                        {isConnected && !isLoading && (
                          <span className="flex items-center ml-2 text-green-600 dark:text-green-500">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Connected
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <Button variant="outline" disabled>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </Button>
                ) : isConnected ? (
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={handleDisconnect}
                      className="border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Disconnect
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://calendar.google.com', '_blank')}
                      className="border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Open Calendar
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => handleConnect('google')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Connect Google Calendar
                  </Button>
                )}
              </div>

              {isConnected && (
                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Automatic meeting joins</h4>
                      <p className="text-sm text-muted-foreground mt-1">Allow Descript to automatically join your scheduled meetings</p>
                    </div>
                    <Switch defaultChecked={true} />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Secondary Google Calendar</h3>
                    <div className="text-sm text-muted-foreground mt-1">Connect an additional Google Calendar account</div>
                  </div>
                </div>
                <Button 
                  onClick={() => handleConnect('secondary-google')}
                  variant="outline"
                  className="border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Connect
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-950 shadow-sm"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
                    <Mail className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Microsoft Outlook Calendar</h3>
                    <div className="text-sm text-muted-foreground mt-1">Connect your Microsoft 365 account calendar</div>
                  </div>
                </div>
                <Button 
                  onClick={() => handleConnect('outlook')}
                  variant="outline"
                  className="border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Connect
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-8 mt-10">
        <h3 className="text-lg font-medium mb-4">Calendar Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
            <div>
              <h4 className="font-medium">Calendar notifications</h4>
              <p className="text-sm text-muted-foreground mt-1">Receive notifications before scheduled meetings</p>
            </div>
            <Switch defaultChecked={true} />
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
            <div>
              <h4 className="font-medium">Auto-transcribe all meetings</h4>
              <p className="text-sm text-muted-foreground mt-1">Automatically generate transcripts for all meetings</p>
            </div>
            <Switch defaultChecked={true} />
          </div>
        </div>
      </div>
    </div>
  );
}

