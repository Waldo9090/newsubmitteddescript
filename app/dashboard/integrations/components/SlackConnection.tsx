"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slack } from "lucide-react";

interface SlackChannel {
  id: string;
  name: string;
  isPrivate?: boolean;
}

interface SlackConnectionProps {
  onBack: () => void;
}

export default function SlackConnection({ onBack }: SlackConnectionProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState({
    meetingNotes: true,
    actionItems: true
  });

  useEffect(() => {
    checkConnection();
  }, [user?.email]);

  const checkConnection = async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const slackIntegration = userDoc.data()?.slackIntegration;

      console.log('Checking Slack integration:', slackIntegration);

      // Check for required fields in slackIntegration
      if (slackIntegration && 
          slackIntegration.teamId && 
          slackIntegration.botUserId && 
          slackIntegration.botEmail) {
        console.log('Found valid Slack integration:', slackIntegration);
        setIsConnected(true);
        await fetchChannels(user.email);

        // Restore saved configuration if it exists
        const steps = userDoc.data()?.steps;
        const slackStep = steps?.find((step: any) => step.id === 'slack');
        if (slackStep) {
          setSelectedChannel(slackStep.config.channelId);
          setSelectedOptions({
            meetingNotes: slackStep.config.meetingNotes,
            actionItems: slackStep.config.actionItems
          });
        }
      } else {
        console.log('No valid Slack integration found');
        setIsConnected(false);
        setChannels([]);
      }
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      toast.error('Failed to check Slack connection status');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannels = async (userEmail: string) => {
    try {
      const response = await fetch('/api/slack/channels', {
        headers: {
          'Authorization': `Bearer ${userEmail}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const data = await response.json();
      if (data.channels) {
        console.log('Fetched channels:', data.channels);
        setChannels(data.channels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to fetch Slack channels');
    }
  };

  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Slack');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await fetch('/api/slack/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.url) {
        localStorage.setItem('slackConnecting', 'true');
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Slack:', error);
      toast.error('Failed to connect to Slack');
      setIsConnecting(false);
    }
  };

  const handleSave = async () => {
    if (!user?.email || !selectedChannel) {
      toast.error('Please select a channel');
      return;
    }

    try {
      const channel = channels.find(c => c.id === selectedChannel);
      if (!channel) {
        throw new Error('Selected channel not found');
      }

      const db = getFirebaseDb();
      const userDocRef = doc(db, 'users', user.email);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const currentSteps = userDoc.data()?.steps || [];
      const updatedSteps = currentSteps.filter((step: any) => step.id !== 'slack');
      
      updatedSteps.push({
        id: 'slack',
        config: {
          channelId: channel.id,
          channelName: channel.name,
          meetingNotes: selectedOptions.meetingNotes,
          actionItems: selectedOptions.actionItems
        },
        createdAt: new Date().toISOString()
      });

      await setDoc(userDocRef, {
        steps: updatedSteps
      }, { merge: true });

      toast.success('Slack configuration saved');
      onBack();
    } catch (error) {
      console.error('Error saving Slack configuration:', error);
      toast.error('Failed to save Slack configuration');
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to disconnect Slack');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await fetch('/api/slack/disconnect', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.success) {
        toast.success('Successfully disconnected from Slack');
        setIsConnected(false);
        setChannels([]);
      }
    } catch (error) {
      console.error('Error disconnecting from Slack:', error);
      toast.error('Failed to disconnect from Slack');
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    // Check for redirect from Slack OAuth
    const params = new URLSearchParams(window.location.search);
    const slackConnected = params.get('slack_connected');
    const error = params.get('error');
    const wasConnecting = localStorage.getItem('slackConnecting');

    if (wasConnecting) {
      localStorage.removeItem('slackConnecting');
      
      if (slackConnected === 'true') {
        toast.success('Successfully connected to Slack');
        checkConnection();
      } else if (error) {
        toast.error(`Failed to connect to Slack: ${decodeURIComponent(error)}`);
        setIsConnecting(false);
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
            <Slack className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium">Slack</h4>
            <p className="text-sm text-muted-foreground">
              {isConnected ? "Connected" : "Not connected"}
            </p>
          </div>
        </div>
        <Button
          onClick={isConnected ? handleDisconnect : handleConnect}
          variant={isConnected ? "outline" : "default"}
          disabled={isConnecting}
          className="rounded-full"
        >
          {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>

      {!isConnected && (
        <div className="text-sm text-muted-foreground">
          Connect your Slack workspace to automatically send meeting notes and action items.
        </div>
      )}

      {/* Keep the form elements but hide them when connected */}
      {isConnected && (
        <div className="hidden">
          <Select 
            value={selectedChannel}
            onValueChange={setSelectedChannel}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Choose a channel..." />
            </SelectTrigger>
            <SelectContent>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  #{channel.name}
                  {channel.isPrivate && " (private)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="meeting-notes"
                checked={selectedOptions.meetingNotes}
                onCheckedChange={(checked) =>
                  setSelectedOptions((prev) => ({ ...prev, meetingNotes: checked as boolean }))
                }
                className="h-5 w-5"
              />
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="action-items"
                checked={selectedOptions.actionItems}
                onCheckedChange={(checked) =>
                  setSelectedOptions((prev) => ({ ...prev, actionItems: checked as boolean }))
                }
                className="h-5 w-5"
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            className="mt-8 py-6 text-lg w-full"
            size="lg"
            disabled={!selectedChannel}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
} 