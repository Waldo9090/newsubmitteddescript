"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slack } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { integrationIcons } from "@/app/lib/integration-icons";

interface SlackChannel {
  id: string;
  name: string;
  isPrivate?: boolean;
}

interface SlackWorkspace {
  teamId: string;
  teamName: string;
  channelId?: string;
  channelName?: string;
}

interface SlackConnectionProps {
  onSave: (config: any) => Promise<void>;
  onCancel: () => void;
  isAutomationForm?: boolean;
  savedConfig?: any;
}

export default function SlackConnection({ onSave, onCancel, isAutomationForm }: SlackConnectionProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [workspace, setWorkspace] = useState<SlackWorkspace | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<{ [key: string]: { sendNotes: boolean; sendActionItems: boolean } }>({});
  const [isFetchingChannels, setIsFetchingChannels] = useState(false);

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

      if (slackIntegration?.accessToken) {
        setIsConnected(true);
        setWorkspace({
          teamId: slackIntegration.teamId,
          teamName: slackIntegration.teamName,
          channelId: slackIntegration.channelId,
          channelName: slackIntegration.channelName,
        });
        await fetchChannels(slackIntegration.accessToken);
      } else {
        setIsConnected(false);
        setWorkspace(null);
        setChannels([]);
      }
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      toast.error('Failed to check Slack connection status');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannels = async (accessToken: string) => {
    if (!user?.email) return;

    try {
      setIsFetchingChannels(true);
      const response = await fetch('/api/slack/channels', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
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
    } finally {
      setIsFetchingChannels(false);
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

  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        slackIntegration: null
      }, { merge: true });
      
      setIsConnected(false);
      setWorkspace(null);
      setChannels([]);
      setSelectedChannels({});
      toast.success('Successfully disconnected from Slack');
    } catch (error) {
      console.error('Error disconnecting from Slack:', error);
      toast.error('Failed to disconnect from Slack');
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels(prev => {
      const newSelectedChannels = { ...prev };
      if (newSelectedChannels[channelId]) {
        delete newSelectedChannels[channelId];
      } else {
        newSelectedChannels[channelId] = {
          sendNotes: true,
          sendActionItems: true
        };
      }
      return newSelectedChannels;
    });
  };

  const handleOptionToggle = (channelId: string, option: 'sendNotes' | 'sendActionItems') => {
    setSelectedChannels(prev => ({
      ...prev,
      [channelId]: {
        ...prev[channelId],
        [option]: !prev[channelId][option]
      }
    }));
  };

  const handleSave = async () => {
    if (!user?.email || !workspace) return;

    try {
      const selectedChannelIds = Object.keys(selectedChannels);

      if (selectedChannelIds.length === 0) {
        toast.error('Please select at least one channel');
        return;
      }

      const selectedChannelDetails = channels
        .filter(channel => selectedChannels[channel.id])
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          ...selectedChannels[channel.id]
        }));

      if (isAutomationForm) {
        // Save to automation configuration
        onSave({
          channels: selectedChannelDetails
        });
      } else {
        // Save to user's Slack integration settings
        const db = getFirebaseDb();
        await setDoc(doc(db, 'users', user.email), {
          slackIntegration: {
            ...workspace,
            selectedChannels,
            channelId: selectedChannelIds[0], // For backward compatibility
            channelName: selectedChannelDetails[0]?.name,
            updatedAt: new Date().toISOString()
          }
        }, { merge: true });
        toast.success('Successfully saved Slack channel preferences');
      }
    } catch (error) {
      console.error('Error saving channel preferences:', error);
      toast.error('Failed to save channel preferences');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Slack className="h-6 w-6" />
            Connect Slack
          </CardTitle>
          <CardDescription>
            Connect your Slack workspace to send meeting notes and action items
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Slack'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Slack</CardTitle>
        <CardDescription>
          Connect your Slack workspace to send meeting notes and action items
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                {integrationIcons.slack.icon}
              </div>
              <div>
                <h4 className="text-sm font-medium">Slack</h4>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? `Connected to ${workspace?.teamName}` : "Not connected"}
                </p>
              </div>
            </div>
            <Button
              onClick={isConnected ? handleDisconnect : handleConnect}
              variant={isConnected ? "outline" : "default"}
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>

          {isConnected && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Available Channels</h4>
                {isFetchingChannels ? (
                  <div className="text-sm text-muted-foreground">Loading channels...</div>
                ) : channels.length > 0 ? (
                  <div className="space-y-2">
                    {channels.map(channel => (
                      <div key={channel.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={!!selectedChannels[channel.id]}
                            onCheckedChange={() => handleChannelToggle(channel.id)}
                          />
                          <span className="text-sm">#{channel.name}</span>
                          {channel.isPrivate && (
                            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
                              Private
                            </span>
                          )}
                        </div>
                        {selectedChannels[channel.id] && (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={selectedChannels[channel.id].sendNotes}
                                onCheckedChange={() => handleOptionToggle(channel.id, 'sendNotes')}
                              />
                              <span className="text-sm">Notes</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={selectedChannels[channel.id].sendActionItems}
                                onCheckedChange={() => handleOptionToggle(channel.id, 'sendActionItems')}
                              />
                              <span className="text-sm">Action Items</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No channels available</div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 