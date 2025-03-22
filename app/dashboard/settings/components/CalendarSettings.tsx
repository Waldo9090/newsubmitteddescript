"use client"

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Mail } from "lucide-react";

export default function CalendarSettings() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Connect your calendar</h2>
        <p className="text-muted-foreground mb-6">
          Have Circleback automatically join only the meetings you choose.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">{user?.email}</div>
                <div className="text-sm text-muted-foreground">Google Calendar</div>
              </div>
            </div>
            {isConnected ? (
              <Button variant="outline">Disconnect</Button>
            ) : (
              <Button onClick={handleConnect}>Connect</Button>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">Secondary Google Calendar</div>
              </div>
            </div>
            <Button>Connect</Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">Microsoft Outlook Calendar</div>
              </div>
            </div>
            <Button>Connect</Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Joining preferences</h2>
        <p className="text-muted-foreground mb-6">
          Choose which meetings on your calendar you'd like Circleback to automatically join. You can use the
          desktop app to record meetings Circleback doesn't join.
        </p>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">All meetings</div>
              <div className="text-sm text-muted-foreground">Join all meetings on my calendar</div>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Pending</div>
              <div className="text-sm text-muted-foreground">Meetings I haven't yet accepted or declined</div>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Not organized by me</div>
              <div className="text-sm text-muted-foreground">
                Meetings where I'm an invitee, not the organizer
              </div>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}

