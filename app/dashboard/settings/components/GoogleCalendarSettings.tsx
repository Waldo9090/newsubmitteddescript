import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GoogleCalendarSettings() {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/calendar/auth', {
        method: 'GET',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
    }
  };

  useEffect(() => {
    // Check if calendar is already connected
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/calendar/status');
        const data = await response.json();
        setIsConnected(data.connected);
      } catch (error) {
        console.error('Error checking calendar connection:', error);
      }
    };
    checkConnection();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your calendar</CardTitle>
        <CardDescription>
          Connect your Google Calendar to see your upcoming meetings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-medium">Google Calendar</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          <Button
            onClick={handleConnect}
            variant={isConnected ? "outline" : "default"}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 