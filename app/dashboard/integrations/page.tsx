"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "../components/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronRight, ChevronLeft, Zap, Share2, Webhook, Tag, Info, X, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Image from "next/image"
//import SlackConnection from "./components/SlackConnection"
//import NotionConnection from "./components/NotionConnection"
//import LinearConnection from "./components/LinearConnection"
//import AttioConnection from "./components/AttioConnection"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getFirebaseDb } from "@/lib/firebase"
import { collection, getDocs, doc, getDoc, setDoc, addDoc, onSnapshot, arrayUnion, updateDoc, serverTimestamp } from "firebase/firestore"
import { useAuth } from "@/context/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import React from "react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { toast as sonnerToast } from "sonner"
import { Label } from "@/components/ui/label"
import { usePathname } from "next/navigation"

interface StepConfig {
  tags?: string[];
  accessToken?: string;
  botId?: string;
  templateId?: string;
  pageId?: string;
  pageTitle?: string;
  workspaceIcon?: string;
  workspaceId?: string;
  workspaceName?: string;
  exportNotes?: boolean;
  exportActionItems?: boolean;
  channelId?: string;
  channelName?: string;
  sendNotes?: boolean;
  sendActionItems?: boolean;
  teamId?: string;
  teamName?: string;
  frequency?: "auto" | "one" | "multiple";
  description?: string;
  name?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  count?: "auto" | "one" | "multiple";
  responses?: Array<{
    content: string;
    meeting: string;
    date: Date;
  }>;
  createdAt?: Date;
  contacts?: boolean;
  deals?: boolean;
  includeMeetingNotes?: boolean;
  includeActionItems?: boolean;
}

interface Step {
  id: string;
  title: string;
  type: StepType;
  config?: StepConfig;
}

interface Tag {
  id: string
  name: string
}

interface SlackChannel {
  id: string;
  name: string;
}

interface Automation {
  id: string;
  name: string;
  steps: {
    id: string;
    name: string;
    type: string;
    config?: any;
  }[];
  createdAt: number;
}

// Add new interfaces for saved automations
interface SavedAutomation {
  id: string;
  steps: {
    [key: string]: any;
  };
  name?: string;
}

// Add interface for message blocks
interface MessageBlock {
  type: string;
  text: {
    type: string;
    text: string;
  };
}

interface IntegrationIcon {
  name: string;
  color: string;
  icon?: LucideIcon;
  iconUrl?: string;
}

interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  type: 'page' | 'database';
}

interface NotionWorkspace {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string;
  selectedPageId?: string;
  selectedPageTitle?: string;
  exportNotes?: boolean;
  exportActionItems?: boolean;
  accessToken?: string;
  botId?: string;
  templateId?: string;
}

const integrationIcons: Record<string, IntegrationIcon> = {
  "ai-insights": {
    name: "Generate insights with AI",
    iconUrl: "/icons/integrations/ai-insights.svg",
    color: "text-purple-500",
  },
  "slack": {
    name: "Send notes to Slack",
    iconUrl: "/icons/integrations/slack.svg",
    color: "text-green-500",
  },
  "notion": {
    name: "Update Notion",
    iconUrl: "/icons/integrations/notion.svg",
    color: "text-gray-900 dark:text-gray-100",
  },
  "linear": {
    name: "Create Linear tasks",
    iconUrl: "/icons/integrations/linear.svg",
    color: "text-blue-500",
  },
  "attio": {
    name: "Sync with Attio",
    iconUrl: "/icons/integrations/Attio.svg",
    color: "text-blue-600",
  },
  hubspot: {
    name: "Update HubSpot",
    color: "#ff7a59",
    iconUrl: "/icons/integrations/hubspot.svg"
  },
}

type StepType = "initial" | "actions" | "notion" | "slack" | "ai-insights" | "trigger" | "hubspot" | "linear" | null;

const getStepIcon = (stepType: string) => {
  const integration = integrationIcons[stepType as keyof typeof integrationIcons];
  if (!integration) return null;
  
  if (integration.icon) {
    const Icon = integration.icon;
    return <Icon className={`h-5 w-5 ${integration.color}`} />;
  }
  
  if (integration.iconUrl) {
    return (
      <Image
        src={integration.iconUrl}
        alt={integration.name}
        width={20}
        height={20}
        className={integration.color}
      />
    );
  }
  
  return null;
};

const getStepConfigDescription = (step: { type: string; config?: any }) => {
  if (!step.config) return null;
  
  switch (step.type) {
    case "trigger":
      return `Tags: ${step.config.tags?.length ? step.config.tags.join(", ") : "Any"}`;
    case "ai-insights":
      return step.config.description;
    default:
      return null;
  }
};

const renderIcon = (integration: IntegrationIcon | undefined) => {
  if (!integration) return null;
  
  if (integration.icon) {
    const Icon = integration.icon;
    return <Icon className={integration.color} />;
  }
  if (integration.iconUrl) {
    return <Image src={integration.iconUrl} alt={integration.name} width={24} height={24} />;
  }
  return null;
};

export default function IntegrationsPage() {
  const [isCreating, setIsCreating] = useState(false)
  const [automationName, setAutomationName] = useState("Untitled Integration")
  const [currentStep, setCurrentStep] = useState<StepType>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [savedAutomations, setSavedAutomations] = useState<SavedAutomation[]>([])
  const [webhookUrl, setWebhookUrl] = useState("")
  const [selectedOptions, setSelectedOptions] = useState({
    meetingNotes: true,
    actionItems: true,
    transcript: false,
  })
  const [triggerStep, setTriggerStep] = useState<"initial" | "conditions" | "actions">("initial")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const { user } = useAuth()
  const [insightName, setInsightName] = useState("")
  const [insightDescription, setInsightDescription] = useState("")
  const [insightCount, setInsightCount] = useState<"auto" | "one" | "multiple">("auto")
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [slackConnected, setSlackConnected] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState("")
  const [channels, setChannels] = useState<Array<{ id: string; name: string; isPrivate?: boolean }>>([])
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [isNotionLoading, setIsNotionLoading] = useState(true);
  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isNotionConnecting, setIsNotionConnecting] = useState(false);
  const [notionWorkspace, setNotionWorkspace] = useState<NotionWorkspace | null>(null);
  const [notionPages, setNotionPages] = useState<NotionPage[]>([]);
  const [selectedNotionPage, setSelectedNotionPage] = useState<string>("");
  const [notionExportOptions, setNotionExportOptions] = useState({
    notes: true,
    actionItems: true
  });
  const [hubspotConfig, setHubspotConfig] = useState({
    contacts: true,
    deals: false,
    includeMeetingNotes: true,
    includeActionItems: true
  });
  const [hubspotConnected, setHubspotConnected] = useState(false);
  const [linearConnected, setLinearConnected] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const fetchTags = async () => {
      if (!user?.email) return
      
      try {
        const db = getFirebaseDb()
        const docRef = doc(db, 'tags', user.email)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          const tags = docSnap.data().tags || []
          setAvailableTags(tags)
        }
      } catch (error) {
        console.error('Error fetching tags:', error)
        sonnerToast("Failed to load tags", { style: { backgroundColor: 'red', color: 'white' } })
      }
    }

    fetchTags();
  }, [user?.email]);

  const fetchSavedAutomations = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      
      // First, ensure the user's document exists in integratedautomations
      const userAutomationsRef = doc(db, 'integratedautomations', user.email);
      
      // Create the automations subcollection reference
      const automationsCollectionRef = collection(userAutomationsRef, 'automations');
      
      // Get all automation documents
      const automationsSnap = await getDocs(automationsCollectionRef);
      
      const automations: SavedAutomation[] = [];
      
      for (const automationDoc of automationsSnap.docs) {
        // Get the steps subcollection for this automation
        const stepsCollectionRef = collection(automationDoc.ref, 'steps');
        const stepsSnap = await getDocs(stepsCollectionRef);
        
        const steps: { [key: string]: any } = {};
        stepsSnap.forEach(stepDoc => {
          steps[stepDoc.id] = stepDoc.data();
        });

        automations.push({
          id: automationDoc.id,
          name: automationDoc.data().name || automationDoc.id,
          steps: steps
        });
      }

      console.log('Fetched automations:', automations);
      setSavedAutomations(automations);
    } catch (error) {
      console.error('Error fetching automations:', error);
    }
  };

  // Add effect to check URL params and refresh
  useEffect(() => {
    const url = new URL(window.location.href);
    const justCreated = url.searchParams.get('automation_created');
    
    if (justCreated === 'true') {
      console.log('Automation just created, refreshing saved automations');
      fetchSavedAutomations();
      
      // Remove the query param
      url.searchParams.delete('automation_created');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Initial fetch of saved automations
  useEffect(() => {
    fetchSavedAutomations();
  }, [user?.email]);

  useEffect(() => {
    const checkConnections = async () => {
      if (!user?.email) return;
      
      try {
        setIsNotionLoading(true);
        
        // First try the debug endpoint for Notion
        try {
          console.log('Trying debug endpoint for Notion status');
          const debugResponse = await fetch(`/api/debug/notion-status?email=${encodeURIComponent(user.email)}`);
          const debugData = await debugResponse.json();
          
          if (debugData.hasNotionIntegration && debugData.notionIntegrationKeys?.includes('accessToken')) {
            console.log('Debug endpoint confirmed Notion is connected');
            const notionIntegration = debugData.fullUserDocument.notionIntegration;
            setIsNotionConnected(true);
            setNotionWorkspace({
              workspaceId: notionIntegration.workspaceId,
              workspaceName: notionIntegration.workspaceName,
              workspaceIcon: notionIntegration.workspaceIcon,
              selectedPageId: notionIntegration.selectedPageId,
              selectedPageTitle: notionIntegration.selectedPageTitle,
              exportNotes: notionIntegration.exportNotes,
              exportActionItems: notionIntegration.exportActionItems,
              accessToken: notionIntegration.accessToken,
              botId: notionIntegration.botId,
              templateId: notionIntegration.templateId
            });
            await fetchNotionPages();
            setIsNotionLoading(false);
            return;
          }
        } catch (debugError) {
          console.error('Error using debug endpoint:', debugError);
        }

        // Fall back to direct Firestore access
        const db = getFirebaseDb();
        const userDoc = await getDoc(doc(db, 'users', user.email));
        const userData = userDoc.data();
        
        if (userData) {
          const notionIntegration = userData.notionIntegration;
          
          if (notionIntegration?.accessToken) {
            setIsNotionConnected(true);
            setNotionWorkspace({
              workspaceId: notionIntegration.workspaceId || '',
              workspaceName: notionIntegration.workspaceName || '',
              workspaceIcon: notionIntegration.workspaceIcon || null,
              selectedPageId: notionIntegration.selectedPageId || '',
              selectedPageTitle: notionIntegration.selectedPageTitle || '',
              exportNotes: notionIntegration.exportNotes || true,
              exportActionItems: notionIntegration.exportActionItems || true,
              accessToken: notionIntegration.accessToken,
              botId: notionIntegration.botId || '',
              templateId: notionIntegration.templateId || ''
            });
            await fetchNotionPages();
          } else {
            setIsNotionConnected(false);
            setNotionWorkspace(null);
          }

          // Check Slack connection
          const slackIntegration = userData.slackIntegration;
          if (slackIntegration && 
              slackIntegration.teamId && 
              slackIntegration.botUserId && 
              slackIntegration.botEmail) {
            console.log('Found valid Slack integration:', slackIntegration);
            setSlackConnected(true);
            await fetchSlackChannels(user.email);
          } else {
            console.log('No valid Slack integration found');
            setSlackConnected(false);
          }

          // Check Linear connection
          const linearIntegration = userData?.linearIntegration;
          if (linearIntegration?.accessToken) {
            setLinearConnected(true);
            
            // Fetch Linear teams
            const teamsResponse = await fetch('https://api.linear.app/graphql', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${linearIntegration.accessToken}`
              },
              body: JSON.stringify({
                query: `
                  query {
                    teams {
                      nodes {
                        id
                        name
                      }
                    }
                  }
                `
              })
            });

            if (teamsResponse.ok) {
              const teamsData = await teamsResponse.json();
              if (teamsData.data?.teams?.nodes) {
                setTeams(teamsData.data.teams.nodes);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking connections:', error);
      } finally {
        setIsNotionLoading(false);
      }
    };

    checkConnections();
  }, [user?.email]);

  useEffect(() => {
    console.log('Steps state updated:', steps);
  }, [steps]);

  // Add listener for new transcripts
  useEffect(() => {
    if (!user?.email) return;

    const db = getFirebaseDb();
    const userEmail = user.email;
    const transcriptRef = collection(db, 'transcript', userEmail, 'timestamps');
    
    const unsubscribe = onSnapshot(
      transcriptRef,
      { includeMetadataChanges: true },
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          // Only process documents that are newly added
          if (change.type === 'added' && change.doc.metadata.hasPendingWrites) {
            const meetingData = change.doc.data();
            const transcript = meetingData.transcript || '';

            try {
              // Check if Notion is configured
              const userDocRef = doc(db, 'users', userEmail);
              const userDocSnap = await getDoc(userDocRef);
              const notionIntegration = userDocSnap.data()?.notionIntegration;

              // If Notion is configured and has a selected page, sync the meeting
              if (notionIntegration?.accessToken && notionIntegration?.selectedPageId) {
                try {
                  console.log('Attempting to sync meeting to Notion:', {
                    meetingId: change.doc.id,
                    targetPageId: notionIntegration.selectedPageId
                  });

                  const response = await fetch('/api/notion/sync', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${user.email}`
                    },
                    body: JSON.stringify({
                      meetingId: change.doc.id,
                      targetPageId: notionIntegration.selectedPageId
                    }),
                  });

                  const responseData = await response.json();
                  if (!response.ok) {
                    throw new Error(responseData.error || 'Failed to sync with Notion');
                  }

                  console.log('Successfully synced meeting to Notion:', responseData);
                  sonnerToast("Meeting notes synced to Notion", { style: { backgroundColor: 'green', color: 'white' } });
                } catch (notionError) {
                  console.error('Error syncing to Notion:', notionError);
                  sonnerToast(notionError instanceof Error ? notionError.message : 'Failed to sync meeting to Notion', { style: { backgroundColor: 'red', color: 'white' } });
                }
              }

              // Get insights collection for the user
              const insightsRef = collection(db, 'insights', userEmail, 'insights');
              const insightsSnap = await getDocs(insightsRef);
              
              // Process each insight configuration
              for (const doc of insightsSnap.docs) {
                const insight = doc.data();

                // Generate prompt for GPT
                const response = await fetch('/api/insights/analyze', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    transcript,
                    description: insight.description,
                  }),
                });

                if (!response.ok) {
                  throw new Error('Failed to analyze transcript');
                }

                const { content } = await response.json();

                // Update insight with new response
                await updateDoc(doc.ref, {
                  responses: arrayUnion({
                    content,
                    meeting: meetingData.title || 'Untitled Meeting',
                    date: new Date()
                  })
                });

                sonnerToast("Generated insights for \"" + doc.id + "\"", { style: { backgroundColor: 'green', color: 'white' } });
              }
            } catch (error) {
              console.error('Error processing insights:', error);
              sonnerToast("Failed to generate insights", { style: { backgroundColor: 'red', color: 'white' } });
            }
          }
        }
      }
    );

    return () => unsubscribe();
  }, [user?.email]);

  // Separate useEffect for fetching channels when connection status changes
  useEffect(() => {
    const fetchChannels = async () => {
      if (slackConnected && user?.email) {
        try {
          // Get the user's Slack access token
          const db = getFirebaseDb();
          const userDoc = await getDoc(doc(db, 'users', user.email));
          const slackIntegration = userDoc.data()?.slackIntegration;

          if (!slackIntegration?.accessToken) {
            console.error('No Slack access token found');
            return;
          }

          const response = await fetch('/api/slack/channels', {
            headers: {
              'Authorization': `Bearer ${slackIntegration.accessToken}`
            }
          });
          const data = await response.json();
          if (data.channels) {
            setChannels(data.channels);
          }
        } catch (error) {
          console.error('Error fetching Slack channels:', error);
          sonnerToast("Failed to fetch Slack channels", { style: { backgroundColor: 'red', color: 'white' } });
        }
      }
    };

    fetchChannels();
  }, [slackConnected, user?.email]);

  const fetchNotionPages = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/notion/pages', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Notion pages');
      }

      const data = await response.json();
      setNotionPages(data.pages);
    } catch (error) {
      console.error('Error fetching Notion pages:', error);
      sonnerToast("Failed to fetch Notion pages", { style: { backgroundColor: 'red', color: 'white' } });
    }
  };

  const handleNotionConnect = async () => {
    if (!user?.email) {
      sonnerToast("Please sign in to connect Notion", { style: { backgroundColor: 'red', color: 'white' } });
      return;
    }

    try {
      setIsNotionConnecting(true);
      const response = await fetch('/api/notion/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Notion:', error);
      sonnerToast("Failed to connect to Notion", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsNotionConnecting(false);
    }
  };

  const handleNotionDisconnect = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        notionIntegration: null
      }, { merge: true });
      
      setIsNotionConnected(false);
      setNotionWorkspace(null);
      setNotionPages([]);
      setSelectedNotionPage("");
      sonnerToast("Successfully disconnected from Notion", { style: { backgroundColor: 'green', color: 'white' } });
    } catch (error) {
      console.error('Error disconnecting from Notion:', error);
      sonnerToast("Failed to disconnect from Notion", { style: { backgroundColor: 'red', color: 'white' } });
    }
  };

  const handleNotionPageSelect = async () => {
    if (!user?.email || !selectedNotionPage) {
      console.log('Missing required data:', { userEmail: user?.email, selectedNotionPage });
      return;
    }

    try {
      console.log('Starting Notion page selection...', {
        selectedNotionPage,
        notionExportOptions,
        notionWorkspace
      });

      const selectedPage = notionPages.find(p => p.id === selectedNotionPage);
      if (!selectedPage) {
        console.log('Selected page not found in notionPages');
        return;
      }

      // Create a clean config object with only the fields we need
      const notionConfig = {
        workspaceId: notionWorkspace?.workspaceId || '',
        workspaceName: notionWorkspace?.workspaceName || '',
        workspaceIcon: notionWorkspace?.workspaceIcon || '',
        selectedPageId: selectedPage.id,
        selectedPageTitle: selectedPage.title,
        exportNotes: notionExportOptions.notes,
        exportActionItems: notionExportOptions.actionItems,
        accessToken: notionWorkspace?.accessToken || ''
      };
      console.log('Created Notion config:', notionConfig);

      const db = getFirebaseDb();
      console.log('Got Firebase DB instance');

      await setDoc(doc(db, 'users', user.email), {
        notionIntegration: notionConfig
      }, { merge: true });
      console.log('Saved Notion config to Firebase');

      setNotionWorkspace(prev => prev ? {
        ...prev,
        ...notionConfig
      } : notionConfig);
      console.log('Updated notionWorkspace state');

      // Add Notion as a step
      const stepData: Step = {
        id: 'notion',
        type: 'notion',
        title: 'Export to Notion',
        config: {
          pageId: selectedPage.id,
          pageTitle: selectedPage.title,
          workspaceIcon: notionConfig.workspaceIcon,
          workspaceId: notionConfig.workspaceId,
          workspaceName: notionConfig.workspaceName,
          exportNotes: notionConfig.exportNotes,
          exportActionItems: notionConfig.exportActionItems
        }
      };
      console.log('Created step data:', stepData);

      setSteps(prev => {
        const newSteps = [...prev, stepData];
        console.log('Updated steps:', newSteps);
        return newSteps;
      });
      
      setCurrentStep(null);
      console.log('Reset current step to null');

      sonnerToast("Notion settings saved successfully", { style: { backgroundColor: 'green', color: 'white' } });
    } catch (error) {
      console.error('Error saving Notion settings:', error, {
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      sonnerToast("Failed to save Notion settings", { style: { backgroundColor: 'red', color: 'white' } });
    }
  };

  const checkSlackConnection = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const slackIntegration = userDoc.data()?.slackIntegration;

      console.log('Checking Slack integration:', slackIntegration);

      if (slackIntegration?.teamId) {
        console.log('Found Slack integration:', slackIntegration);
        setSlackConnected(true);
        await fetchSlackChannels(user.email);

        // Restore saved configuration if it exists
        const automationDoc = await getDoc(doc(db, 'integratedAutomations', user.email));
        const slackConfig = automationDoc.data()?.slack;
        if (slackConfig) {
          setSelectedChannel(slackConfig.channelId);
          setSelectedOptions(prev => ({
            ...prev,
            meetingNotes: slackConfig.meetingNotes,
            actionItems: slackConfig.actionItems
          }));
        }
      } else {
        console.log('No Slack integration found');
        setSlackConnected(false);
        setChannels([]);
      }
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      sonnerToast("Failed to check Slack connection status", { style: { backgroundColor: 'red', color: 'white' } });
    }
  };

  const fetchSlackChannels = async (userEmail: string) => {
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
      sonnerToast("Failed to fetch Slack channels", { style: { backgroundColor: 'red', color: 'white' } });
    }
  };

  const handleSlackConnect = async () => {
    if (!user?.email) {
      sonnerToast("Please sign in to connect Slack", { style: { backgroundColor: 'red', color: 'white' } });
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
      sonnerToast("Failed to connect to Slack", { style: { backgroundColor: 'red', color: 'white' } });
      setIsConnecting(false);
    }
  };

  const handleChannelSelect = async () => {
    if (!user?.email || !selectedChannel) {
      sonnerToast("Please select a channel", { style: { backgroundColor: 'red', color: 'white' } });
      return;
    }

    try {
      const channel = channels.find(c => c.id === selectedChannel);
      if (!channel) {
        throw new Error('Selected channel not found');
      }

      // Create step data matching the structure needed by notion-export.ts
      const stepData: Step = {
        id: 'slack',
        type: 'slack',
        title: 'Send notes to Slack',
        config: {
          channelId: channel.id,
          channelName: channel.name,
          sendNotes: selectedOptions.meetingNotes,
          sendActionItems: selectedOptions.actionItems
        }
      };

      // Add step to steps array
      setSteps(prev => [...prev, stepData]);

      // Save to integratedAutomations collection
      const db = getFirebaseDb();
      const automationDocRef = doc(db, 'integratedAutomations', user.email);
      
      // Get current automations
      const automationDoc = await getDoc(automationDocRef);
      const currentAutomations = automationDoc.exists() ? automationDoc.data() : {};

      // Update Slack configuration with default name
      await setDoc(automationDocRef, {
        ...currentAutomations,
        name: "Untitled Integration",
        slack: {
          type: 'slack',
          config: {
            channelId: channel.id,
            channelName: channel.name,
            sendNotes: selectedOptions.meetingNotes,
            sendActionItems: selectedOptions.actionItems
          },
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      sonnerToast("Slack configuration saved", { style: { backgroundColor: 'green', color: 'white' } });
      setCurrentStep(null);
    } catch (error) {
      console.error('Error saving Slack configuration:', error);
      sonnerToast("Failed to save Slack configuration", { style: { backgroundColor: 'red', color: 'white' } });
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
        sonnerToast("Successfully connected to Slack", { style: { backgroundColor: 'green', color: 'white' } });
        checkSlackConnection();
      } else if (error) {
        sonnerToast(`Failed to connect to Slack: ${decodeURIComponent(error)}`, { style: { backgroundColor: 'red', color: 'white' } });
        setIsConnecting(false);
      }
    }
  }, []);

  if (!isCreating) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold mb-6">Integrations</h1>

          <div className="space-y-6">
            <div className="bg-muted/40 rounded-lg p-8 space-y-4 transform transition-all hover:bg-muted/50">
              <h3 className="text-xl font-semibold">Supercharge Your Workflow</h3>
              <p className="text-muted-foreground">
                Connect your favorite tools and let DescriptAI do the heavy lifting.
              </p>
              <p className="text-muted-foreground">
                Automatically sync meeting notes to Notion, create tasks in Linear, send updates to Slack, and more - all without lifting a finger.
              </p>
              <Button 
                onClick={() => setIsCreating(true)} 
                className="mt-4 transform transition-all hover:scale-105 active:scale-95"
              >
                Create integration
              </Button>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Saved Integrations</h3>
              <div className="grid gap-4">
                {savedAutomations.map((automation) => (
                  <Card 
                    key={automation.id}
                    className="cursor-pointer transform transition-all duration-200 hover:bg-accent/50 hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => router.push(`/dashboard/integrations/${automation.id}`)}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
                      <div className="flex items-center gap-4">
                        <CardTitle className="font-normal">{automation.name || automation.id}</CardTitle>
                        <div className="flex items-center gap-2">
                          {Object.values(automation.steps).map((step, index) => {
                            const stepType = step.type;
                            const integration = integrationIcons[stepType];
                            if (!integration) return null;
                            
                            return (
                              <div
                                key={`${automation.id}-${stepType}-${index}`}
                                className="h-6 w-6 rounded-md bg-background flex items-center justify-center transform transition-all hover:scale-110"
                                title={integration.name}
                              >
                                {integration.iconUrl && (
                                  <Image
                                    src={integration.iconUrl}
                                    alt={integration.name}
                                    width={16}
                                    height={16}
                                    className={`${integration.color} transform transition-all`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transform transition-transform group-hover:translate-x-1" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap mt-8">
              {Object.entries(integrationIcons).map(([id, integration]) => (
                <div
                  key={id}
                  className="h-10 w-10 rounded-lg bg-background flex items-center justify-center transform transition-all hover:scale-110 hover:shadow-md"
                >
                  {integration && renderIcon(integration)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const renderTriggerStep = () => {
    if (triggerStep === "initial") {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-medium">Trigger</h2>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">When to run</h3>
            <p className="text-muted-foreground mb-6">
              Select specific meeting tags to trigger this integration. Without any conditions, the integration will process all meetings automatically.
            </p>

            <div className="bg-muted/30 p-6 rounded-lg space-y-4">
              {selectedTags.map((tag, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  <div className="flex items-center gap-2">
                    <span>{tag}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-0 h-auto"
                      onClick={() => setSelectedTags(tags => tags.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <span>include</span>
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                <Select 
                  onValueChange={(value) => {
                    if (!selectedTags.includes(value)) {
                      setSelectedTags(prev => [...prev, value])
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select tags" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTags
                      .filter(tag => !selectedTags.includes(tag))
                      .map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <span>include</span>
              </div>

              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => {
                  const remainingTags = availableTags.filter(tag => !selectedTags.includes(tag))
                  if (remainingTags.length > 0) {
                    setSelectedTags(prev => [...prev, remainingTags[0]])
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add condition
              </Button>
            </div>

            <Button variant="outline" className="mt-4">
              Add another condition group
            </Button>

            <div className="mt-8">
              <Button onClick={() => {
                setTriggerStep("actions")
                const tagsList = selectedTags.length > 0 ? selectedTags.join(", ") : "any"
                setSteps((prev) => [...prev, {
                  id: "trigger",
                  title: `After every meeting with tags: ${tagsList}`,
                  type: "trigger",
                  config: { tags: selectedTags }
                }])
              }} className="w-32">
                Next
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (triggerStep === "actions") {
      return renderStepContent()
    }

    return null
  }

  const renderStepContent = () => {
    if (currentStep === "notion") {
      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Export to Notion
          </button>

          <Card>
            <CardHeader>
              <CardTitle>Connect Notion</CardTitle>
              <CardDescription>
                Connect your Notion workspace to export meeting content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                      {renderIcon(integrationIcons.notion)}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">Notion</h4>
                      <p className="text-sm text-muted-foreground">
                        {isNotionConnected ? `Connected to ${notionWorkspace?.workspaceName}` : "Not connected"}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={isNotionConnected ? handleNotionDisconnect : handleNotionConnect}
                    variant={isNotionConnected ? "outline" : "default"}
                    disabled={isNotionConnecting}
                  >
                    {isNotionConnecting ? "Connecting..." : isNotionConnected ? "Disconnect" : "Connect"}
                  </Button>
                </div>

                {isNotionConnected && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Select Page</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Choose where to export your meeting content
                      </p>
                      <Select 
                        value={selectedNotionPage} 
                        onValueChange={setSelectedNotionPage}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a page" />
                        </SelectTrigger>
                        <SelectContent>
                          {notionPages.map((page) => (
                            <SelectItem key={page.id} value={page.id}>
                              {page.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2">What to include</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Choose what you'd like to export to Notion
                      </p>
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="notion-meeting-notes"
                            checked={notionExportOptions.notes}
                            onCheckedChange={(checked) =>
                              setNotionExportOptions(prev => ({ ...prev, notes: checked as boolean }))
                            }
                          />
                          <label htmlFor="notion-meeting-notes" className="text-sm font-medium">
                            Meeting notes
                          </label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id="notion-action-items"
                            checked={notionExportOptions.actionItems}
                            onCheckedChange={(checked) =>
                              setNotionExportOptions(prev => ({ ...prev, actionItems: checked as boolean }))
                            }
                          />
                          <label htmlFor="notion-action-items" className="text-sm font-medium">
                            Action items
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                      <Button variant="outline" onClick={() => setCurrentStep(null)}>
                        Cancel
                      </Button>
                      <Button onClick={handleNotionPageSelect}>
                        Save Settings
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentStep === "slack") {
      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Send notes to Slack
          </button>

          <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
            {!slackConnected ? (
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Connect to Slack</h2>
                <p className="text-muted-foreground">
                  Connect your Slack workspace to send meeting notes and action items.
                </p>
                <Button onClick={handleSlackConnect} disabled={isConnecting}>
                  {isConnecting ? 'Connecting...' : 'Connect Slack'}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-3">Channel</h2>
                  <p className="text-muted-foreground mb-4">
                    Select the Slack channel you'd like to send your notes to. To select a private channel, add
                    @DescriptAI to it first.
                  </p>
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
                </div>

                <div>
                  <h2 className="text-lg font-medium mb-3">What to include</h2>
                  <p className="text-muted-foreground mb-4">Choose what you'd like to send to Slack.</p>
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
                      <label htmlFor="meeting-notes" className="text-base font-medium">
                        Meeting notes
                      </label>
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
                      <label htmlFor="action-items" className="text-base font-medium">
                        Action items
                      </label>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleChannelSelect}
                  className="mt-8 py-6 text-lg w-full"
                  size="lg"
                  disabled={!selectedChannel}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (currentStep === "ai-insights") {
      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Generate insights with AI
          </button>
          <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
            <div>
              <h2 className="text-lg font-medium mb-3">Insight name</h2>
              <Input
                placeholder="Client obstacles"
                className="text-base"
                value={insightName}
                onChange={(e) => setInsightName(e.target.value)}
                required
              />
            </div>

            <div>
              <h2 className="text-lg font-medium mb-3">Description</h2>
              <p className="text-muted-foreground mb-4">
                Describe in detail what you'd like generated from your meetings.
              </p>
              <Textarea
                placeholder="The challenges or obstacles the client brings up about fintech's analytics platform. For example, they're finding it hard to onboard to fintech's analytics platform."
                className="min-h-[100px] text-base"
                value={insightDescription}
                onChange={(e) => setInsightDescription(e.target.value)}
                required
              />
            </div>

            <div>
              <h2 className="text-lg font-medium mb-3">Insights per meeting</h2>
              <p className="text-muted-foreground mb-4">
                Choose how many instances of this insight should be generated per meeting.
              </p>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <RadioGroup value={insightCount} onValueChange={(value: "auto" | "one" | "multiple") => setInsightCount(value)}>
                    <div className="flex items-center space-x-3 mb-4">
                      <RadioGroupItem value="auto" id="auto" />
                      <div>
                        <label htmlFor="auto" className="text-base font-medium block">Choose for me</label>
                        <p className="text-sm text-muted-foreground">How many of this insight to generate per meeting will be chosen automatically.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 mb-4">
                      <RadioGroupItem value="one" id="one" />
                      <div>
                        <label htmlFor="one" className="text-base font-medium block">One</label>
                        <p className="text-sm text-muted-foreground">One of this insight will be generated per meeting at most.</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="multiple" id="multiple" />
                      <div>
                        <label htmlFor="multiple" className="text-base font-medium block">Multiple</label>
                        <p className="text-sm text-muted-foreground">One or more of this insight may be generated per meeting.</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            <Button
              onClick={saveInsight}
              className="mt-8 py-6 text-lg w-full"
              size="lg"
            >
              Done
            </Button>
          </div>
        </div>
      )
    }

    if (currentStep === "hubspot") {
      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Update HubSpot
          </button>

          <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
            {!hubspotConnected ? (
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Connect to HubSpot</h2>
                <p className="text-muted-foreground">
                  Connect your HubSpot account to log meetings and action items.
                </p>
                <Button onClick={handleHubSpotConnect}>Connect HubSpot</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-3">What to update</h2>
                  <p className="text-muted-foreground mb-4">
                    Choose what you would like to have updated in HubSpot.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Contacts</Label>
                        <p className="text-sm text-muted-foreground">
                          Log a meeting for matching contacts.
                        </p>
                      </div>
                      <Switch
                        checked={hubspotConfig.contacts}
                        onCheckedChange={(checked) => 
                          setHubspotConfig(prev => ({ ...prev, contacts: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Deals</Label>
                        <p className="text-sm text-muted-foreground">
                          Log a meeting for deals with matching contacts.
                        </p>
                      </div>
                      <Switch
                        checked={hubspotConfig.deals}
                        onCheckedChange={(checked) => 
                          setHubspotConfig(prev => ({ ...prev, deals: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-medium mb-3">What to include</h2>
                  <p className="text-muted-foreground mb-4">
                    Choose what information to include in the HubSpot meeting.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Meeting notes</Label>
                        <p className="text-sm text-muted-foreground">
                          Include the meeting notes in HubSpot.
                        </p>
                      </div>
                      <Switch
                        checked={hubspotConfig.includeMeetingNotes}
                        onCheckedChange={(checked) => 
                          setHubspotConfig(prev => ({ ...prev, includeMeetingNotes: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Action items</Label>
                        <p className="text-sm text-muted-foreground">
                          Include action items in HubSpot.
                        </p>
                      </div>
                      <Switch
                        checked={hubspotConfig.includeActionItems}
                        onCheckedChange={(checked) => 
                          setHubspotConfig(prev => ({ ...prev, includeActionItems: checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleHubSpotSave}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (currentStep === "linear") {
      return (
        <div>
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Create issues in Linear
          </button>

          <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
            {!linearConnected ? (
              <div className="space-y-4">
                <h2 className="text-lg font-medium">Connect to Linear</h2>
                <p className="text-muted-foreground">
                  Connect your Linear workspace to create issues from action items.
                </p>
                <Button onClick={handleLinearConnect}>Connect Linear</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-3">Team</h2>
                  <p className="text-muted-foreground mb-4">
                    Select the Linear team you'd like to create issues in.
                  </p>
                  <Select 
                    value={selectedTeam}
                    onValueChange={setSelectedTeam}
                  >
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Choose a team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleLinearSave}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h2 className="text-xl font-medium">Next Steps</h2>
          </div>
          <div className="divide-y">
            <button
              className="w-full p-6 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentStep("ai-insights")}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {renderIcon(integrationIcons["ai-insights"])}
              </div>
              <span className="font-medium text-left text-lg">{integrationIcons["ai-insights"].name}</span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>
            
            <button
              className="w-full p-6 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentStep("notion")}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {renderIcon(integrationIcons["notion"])}
              </div>
              <span className="font-medium text-left text-lg">{integrationIcons["notion"].name}</span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>
            
            <button
              className="w-full p-6 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentStep("slack")}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {renderIcon(integrationIcons["slack"])}
              </div>
              <span className="font-medium text-left text-lg">{integrationIcons["slack"].name}</span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>
            
            <button
              className="w-full p-6 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentStep("hubspot")}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {renderIcon(integrationIcons["hubspot"])}
              </div>
              <span className="font-medium text-left text-lg">{integrationIcons["hubspot"].name}</span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>

            <button
              className="w-full p-6 flex items-center gap-4 hover:bg-muted/50 transition-colors"
              onClick={() => setCurrentStep("linear")}
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {renderIcon(integrationIcons["linear"])}
              </div>
              <span className="font-medium text-left text-lg">{integrationIcons["linear"].name}</span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const saveInsight = async () => {
    if (!user?.email) {
      sonnerToast("Please sign in to save insights", { style: { backgroundColor: 'red', color: 'white' } });
      return
    }

    if (!insightName.trim()) {
      sonnerToast("Please enter an insight name", { style: { backgroundColor: 'red', color: 'white' } });
      return
    }

    if (!insightDescription.trim()) {
      sonnerToast("Please enter a description", { style: { backgroundColor: 'red', color: 'white' } });
      return
    }

    try {
      // Add the insight to steps
      setSteps((prev) => [...prev, {
        id: "ai-insights",
        title: "Generate insights with AI",
        type: "ai-insights",
        config: {
          name: insightName,
          description: insightDescription,
          count: insightCount,
          responses: [], // Initialize empty responses array
          createdAt: new Date()
        }
      }]);
      
      sonnerToast("AI Insight step added successfully", { style: { backgroundColor: 'green', color: 'white' } });
      
      setCurrentStep(null);
    } catch (error) {
      console.error('Error adding insight step:', error)
      sonnerToast("Failed to add insight step", { style: { backgroundColor: 'red', color: 'white' } });
    }
  }

  const saveAutomation = async () => {
    if (!user?.email) {
      console.error('No user email found');
      sonnerToast("Please sign in to save automation", { style: { backgroundColor: 'red', color: 'white' } });
      return;
    }

    // Use default name if none is provided
    const finalAutomationName = automationName.trim() || "Untitled Integration";

    try {
      setIsSaving(true);
      console.log('Starting automation save process...', {
        userEmail: user.email,
        automationName: finalAutomationName,
        steps,
        validSteps: steps.filter(step => step.type && step.type !== "initial" && step.type !== "actions")
      });

      const db = getFirebaseDb();
      console.log('Got Firebase DB instance');
      
      // Generate a unique ID for the automation document instead of using the name
      const automationsCollectionRef = collection(db, 'integratedautomations', user.email, 'automations');
      console.log('Created automations collection ref');
      
      const newAutomationDocRef = doc(automationsCollectionRef);
      const automationId = newAutomationDocRef.id;
      console.log('Generated new automation ID:', automationId);
      
      // Create the automation document with a unique ID but store the name as a field
      await setDoc(newAutomationDocRef, {
        name: finalAutomationName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Created main automation document');
      
      // Filter out steps with null type or initial/actions
      const validSteps = steps.filter(step => 
        step.type && step.type !== "initial" && step.type !== "actions"
      );
      console.log('Filtered valid steps:', validSteps);
      
      // Create steps subcollection and save each step with numerical ID
      const stepsCollection = collection(newAutomationDocRef, 'steps');
      
      for (let i = 0; i < validSteps.length; i++) {
        const step = validSteps[i];
        const stepDoc = doc(stepsCollection, i.toString()); // Use numerical index as document ID
        console.log(`Processing step ${i}:`, step);
        
        // Base step data structure
        const stepData = {
          id: step.type, // This will be 'notion', 'slack', etc.
          type: step.type
        };

        // Add configuration based on step type
        if (step.config) {
          console.log(`Adding config for step type ${step.type}:`, step.config);
          switch (step.type) {
            case 'notion':
              Object.assign(stepData, {
                pageId: step.config.pageId || "",
                pageTitle: step.config.pageTitle || "",
                workspaceIcon: step.config.workspaceIcon || "",
                workspaceId: step.config.workspaceId || "",
                workspaceName: step.config.workspaceName || "",
                exportNotes: step.config.exportNotes || false,
                exportActionItems: step.config.exportActionItems || false
              });
              break;

            case 'slack':
              Object.assign(stepData, {
                channelId: step.config.channelId || "",
                channelName: step.config.channelName || "",
                sendNotes: step.config.sendNotes || false,
                sendActionItems: step.config.sendActionItems || false
              });
              break;

            case 'ai-insights':
              Object.assign(stepData, {
                name: step.config.name || "",
                description: step.config.description || "",
                count: step.config.count || "auto",
                responses: step.config.responses || [],
                createdAt: step.config.createdAt || new Date()
              });
              break;

            case 'trigger':
              Object.assign(stepData, {
                tags: step.config.tags || []
              });
              break;

            case 'linear':
              Object.assign(stepData, {
                teamId: step.config.teamId || "",
                teamName: step.config.teamName || ""
              });
              break;
          }
        }

        // Save the step document
        console.log(`Saving step ${i} data:`, stepData);
        await setDoc(stepDoc, stepData);
        console.log(`Successfully saved step ${i} of type ${step.type}`);
      }

      console.log('All steps saved successfully');
      sonnerToast("Automation Created", { description: `"${finalAutomationName}" has been saved successfully`, style: { backgroundColor: 'green', color: 'white' } });
      
      // Reset the form state
      setIsCreating(false);
      setTriggerStep("initial");
      setSteps([]);
      setSelectedTags([]);
      setAutomationName("");
      
      // Navigate back to the main integrations page with the created parameter
      router.push('/dashboard/integrations?automation_created=true');
    } catch (error) {
      console.error('Error saving automation:', error, {
        errorDetails: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      sonnerToast("Failed to save automation", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStepChange = (newStep: StepType) => {
    setCurrentStep(newStep);
  };

  const handleStepSelect = (step: string) => {
    handleStepChange(step as StepType);
  };

  const handleStepConfigSave = async (type: string, config: any): Promise<void> => {
    // Implement the logic to save the step configuration
    console.log('Saving step configuration:', type, config);
  };

  const handleHubSpotConnect = async () => {
    if (!user?.email) {
      sonnerToast("Please sign in to connect HubSpot", { style: { backgroundColor: 'red', color: 'white' } });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/hubspot/auth', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to HubSpot:', error);
      sonnerToast("Failed to connect to HubSpot", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsSaving(false);
    }
  };

  const handleHubSpotSave = async () => {
    if (!user?.email) return;

    try {
      setIsSaving(true);
      const stepData: Step = {
        id: 'hubspot',
        type: 'hubspot',
        title: 'HubSpot Integration',
        config: {
          contacts: hubspotConfig.contacts,
          deals: hubspotConfig.deals,
          includeMeetingNotes: hubspotConfig.includeMeetingNotes,
          includeActionItems: hubspotConfig.includeActionItems
        }
      };

      setSteps(prev => [...prev, stepData]);
      sonnerToast("HubSpot integration configured successfully", { style: { backgroundColor: 'green', color: 'white' } });
      setCurrentStep(null);
    } catch (error) {
      console.error('Error saving HubSpot config:', error);
      sonnerToast("Failed to save HubSpot configuration", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinearConnect = async () => {
    if (!user?.email) {
      sonnerToast("Please sign in to connect Linear", { style: { backgroundColor: 'red', color: 'white' } });
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/linear/auth', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Linear:', error);
      sonnerToast("Failed to connect to Linear", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinearSave = async () => {
    if (!user?.email) return;

    try {
      setIsSaving(true);
      const stepData: Step = {
        id: 'linear',
        type: 'linear',
        title: 'Linear Integration',
        config: {
          teamId: selectedTeam
        }
      };

      setSteps(prev => [...prev, stepData]);
      sonnerToast("Linear integration configured successfully", { style: { backgroundColor: 'green', color: 'white' } });
      setCurrentStep(null);
    } catch (error) {
      console.error('Error saving Linear config:', error);
      sonnerToast("Failed to save Linear configuration", { style: { backgroundColor: 'red', color: 'white' } });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 pt-12 max-w-3xl mx-auto">
        <div className="flex flex-col items-start mb-16">
          <Input
            value={automationName}
            onChange={(e) => setAutomationName(e.target.value)}
            className="text-5xl font-bold bg-transparent border-0 p-0 h-auto w-auto focus-visible:ring-0 tracking-tight leading-none mb-8"
            placeholder="Untitled Integration"
          />
          <div className="flex gap-3 self-end">
            <Button variant="outline" onClick={() => {
              setIsCreating(false)
              setTriggerStep("initial")
              setSteps([])
              setSelectedTags([])
            }} className="text-base px-6">
              Cancel
            </Button>
            <Button className="text-base px-6" onClick={saveAutomation}>Create</Button>
          </div>
        </div>

        <div>
          <div className="space-y-8 mb-12">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border cursor-pointer"
                onClick={() => {
                  if (step.id === "trigger") {
                    setTriggerStep("initial")
                    setCurrentStep(null)
                  }
                }}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {renderIcon(integrationIcons[step.type as keyof typeof integrationIcons])}
                </div>
                <span className="font-medium text-lg">{step.title}</span>
                <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>

          <div className="mt-8">{renderTriggerStep()}</div>
        </div>
      </div>
    </DashboardLayout>
  )
}

