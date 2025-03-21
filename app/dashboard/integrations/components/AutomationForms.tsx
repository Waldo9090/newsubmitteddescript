"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slack } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import EmailAutomations from "../../settings/components/EmailAutomations";
import InsightAutomations from "./InsightAutomations";
import SlackConnection from "./SlackConnection";
import { toast } from "sonner";

interface SlackChannel {
  id: string;
  name: string;
}

interface AutomationFormsProps {
  selectedAction: string;
  onSave: () => void;
  onCancel: () => void;
  automationName?: string;
  existingConfig?: any;
}

export default function AutomationForms({ selectedAction, onSave, onCancel, automationName = "Untitled Automation", existingConfig }: AutomationFormsProps) {
  const { user } = useAuth();
  const [isSlackConnected, setIsSlackConnected] = useState(false);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<{ [key: string]: boolean }>({});
  const [workspace, setWorkspace] = useState<{ teamId: string; teamName: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedConfig, setSavedConfig] = useState<any>(null);

  useEffect(() => {
    const loadSavedConfig = async () => {
      if (!user?.email || !automationName) return;

      try {
        const db = getFirebaseDb();
        const automationRef = doc(db, 'integratedautomations', user.email, 'automations', automationName);
        const automationDoc = await getDoc(automationRef);

        if (automationDoc.exists()) {
          const data = automationDoc.data();
          setSavedConfig(data.config);
        }
      } catch (error) {
        console.error('Error loading saved configuration:', error);
      }
    };

    if (existingConfig) {
      setSavedConfig(existingConfig);
    } else {
      loadSavedConfig();
    }
  }, [user?.email, automationName, existingConfig]);

  useEffect(() => {
    const checkSlackConnection = async () => {
      if (!user?.email) return;

      try {
        const db = getFirebaseDb();
        const userDoc = await getDoc(doc(db, 'users', user.email));
        const slackIntegration = userDoc.data()?.slackIntegration;

        if (slackIntegration?.accessToken) {
          setIsSlackConnected(true);
          setWorkspace({
            teamId: slackIntegration.teamId,
            teamName: slackIntegration.teamName
          });
          fetchChannels(slackIntegration.accessToken);
        }
      } catch (error) {
        console.error('Error checking Slack connection:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedAction === "slack_notes") {
      checkSlackConnection();
    }
  }, [user?.email, selectedAction]);

  const fetchChannels = async (accessToken: string) => {
    try {
      const response = await fetch('/api/slack/channels', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const data = await response.json();
      if (data.channels) {
        setChannels(data.channels);
        
        // If we have saved config, set the selected channels
        if (savedConfig?.channels) {
          const channelState: { [key: string]: boolean } = {};
          savedConfig.channels.forEach((channel: any) => {
            channelState[channel.id] = true;
          });
          setSelectedChannels(channelState);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const handleSaveAutomation = async (config: any) => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const automationRef = doc(db, 'integratedautomations', user.email);
      const automationDoc = doc(collection(automationRef, 'automations'), automationName);
      
      await setDoc(automationDoc, {
        name: automationName,
        createdAt: new Date(),
        type: selectedAction,
        config: {
          ...(selectedAction === "slack_notes" ? {
            channels: channels.filter(channel => selectedChannels[channel.id]).map(channel => ({
              id: channel.id,
              name: channel.name,
              sendNotes: true,
              sendActionItems: true
            }))
          } : config)
        }
      });

      onSave();
    } catch (error) {
      console.error('Error saving automation:', error);
      toast.error('Failed to save automation');
    }
  };

  const handleChannelToggle = async (channelId: string) => {
    setSelectedChannels(prev => ({
      ...prev,
      [channelId]: !prev[channelId]
    }));
  };

  const handleConnect = async () => {
    try {
      const response = await fetch('/api/slack/auth');
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error connecting to Slack:', error);
    }
  };

  if (selectedAction === "email_automation") {
    return <EmailAutomations />;
  }

  if (selectedAction === "generate_insights") {
    return <InsightAutomations 
      onSave={handleSaveAutomation} 
      onCancel={onCancel} 
      savedConfig={savedConfig}
    />;
  }

  if (selectedAction === "slack_notes") {
    return <SlackConnection 
      onSave={handleSaveAutomation} 
      onCancel={onCancel} 
      isAutomationForm={true}
      savedConfig={savedConfig}
    />;
  }

  // For other actions that don't have forms yet
  return (
    <div className="text-center py-4 text-muted-foreground">
      This automation type is coming soon.
    </div>
  );
} 