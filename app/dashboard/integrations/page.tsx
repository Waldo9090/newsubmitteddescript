"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "../components/DashboardLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronRight, ChevronLeft, Zap, Share2, Webhook, Tag, Info, X, Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Image from "next/image"
import SlackConnection from "./components/SlackConnection"
import NotionConnection from "./components/NotionConnection"
import LinearConnection from "./components/LinearConnection"
import AttioConnection from "./components/AttioConnection"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getFirebaseDb } from "@/lib/firebase"
import { collection, getDocs, doc, getDoc, setDoc, addDoc, onSnapshot, arrayUnion, updateDoc, serverTimestamp } from "firebase/firestore"
import { useAuth } from "@/context/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import React from "react"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

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
  channels?: Array<{
    id: string;
    name: string;
    sendNotes?: boolean;
    sendActionItems?: boolean;
  }>;
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
  }
}

type StepType = "initial" | "actions" | "notion" | "slack" | "ai-insights" | "trigger" | null;

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
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [isNotionConnected, setIsNotionConnected] = useState(false);
  const [isNotionLoading, setIsNotionLoading] = useState(true);
  const [notionWorkspace, setNotionWorkspace] = useState<{
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
  } | null>(null);
  const [notionPages, setNotionPages] = useState<Array<{
    id: string;
    title: string;
    icon?: string;
    type: 'page' | 'database';
  }>>([]);
  const [selectedNotionPage, setSelectedNotionPage] = useState("");
  const [notionExportOptions, setNotionExportOptions] = useState({
    notes: true,
    actionItems: true
  });
  const { toast } = useToast();

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
        toast({
          title: "Error",
          description: "Failed to load tags"
        });
      }
    }

    fetchTags()
  }, [user?.email])

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
                  const response = await fetch('/api/notion/sync', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      meetingId: change.doc.id,
                      targetPageId: notionIntegration.selectedPageId
                    }),
                  });

                  if (!response.ok) {
                    throw new Error('Failed to sync with Notion');
                  }

                  console.log('Successfully synced meeting to Notion');
                } catch (notionError) {
                  console.error('Error syncing to Notion:', notionError);
                  toast({
                    title: "Error",
                    description: "Failed to sync meeting to Notion"
                  });
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

                toast({
                  title: "Success",
                  description: `Generated insights for "${doc.id}"`
                });
              }
            } catch (error) {
              console.error('Error processing insights:', error);
              toast({
                title: "Error",
                description: "Failed to generate insights"
              });
            }
          }
        }
      }
    );

    return () => unsubscribe();
  }, [user?.email]);

  // Update the useEffect that fetches saved automations
  useEffect(() => {
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
        // Don't show error toast here as this might be the first time loading
        // when no automations exist yet
      }
    };

    fetchSavedAutomations();
  }, [user?.email]);

  // Check Slack connection status and handle OAuth callback
  useEffect(() => {
    const checkConnection = async () => {
      if (!user?.email) return;

      // First check URL parameters for OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const slackConnected = urlParams.get('slack_connected');
      const error = urlParams.get('error');

      if (error) {
        toast({
          title: "Error",
          description: `Failed to connect to Slack: ${error}`,
          variant: "destructive"
        });
        return;
      }

      if (slackConnected === 'true') {
        toast({
          title: "Success",
          description: "Successfully connected to Slack!"
        });
        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname);
        await checkSlackConnection();
      } else {
        // Check existing connection status
        await checkSlackConnection();
      }
    };

    checkConnection();
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
          toast({
            title: "Error",
            description: "Failed to fetch Slack channels"
          });
        }
      }
    };

    fetchChannels();
  }, [slackConnected, user?.email]);

  const checkSlackConnection = async () => {
    if (!user?.email) return;
    
    try {
      const db = getFirebaseDb();
      const userDoc = doc(db, 'users', user.email);
      const userSnapshot = await getDoc(userDoc);
      const userData = userSnapshot.data();
      
      if (userData?.slackIntegration?.accessToken) {
        setSlackConnected(true);
        return true;
      } else {
        setSlackConnected(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      toast({
        title: "Error",
        description: "Failed to check Slack connection",
        variant: "destructive"
      });
      setSlackConnected(false);
      return false;
    }
  };

  useEffect(() => {
    checkNotionConnection();
  }, [user?.email]);

  const checkNotionConnection = async () => {
    if (!user?.email) return;

    try {
      setIsNotionLoading(true);
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const notionIntegration = userDoc.data()?.notionIntegration;

      if (notionIntegration?.accessToken) {
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

        // Fetch available pages if connected
        await fetchNotionPages();
      }
    } catch (error) {
      console.error('Error checking Notion connection:', error);
      toast({
        title: "Error",
        description: "Failed to check Notion connection status"
      });
    } finally {
      setIsNotionLoading(false);
    }
  };

  const fetchNotionPages = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/notion/pages', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();

      if (data.pages) {
        setNotionPages(data.pages);
      }
    } catch (error) {
      console.error('Error fetching Notion pages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Notion pages"
      });
    }
  };

  const handleNotionConnect = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please sign in to connect Notion"
      });
      return;
    }

    try {
      const response = await fetch('/api/notion/auth', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get authorization URL');
      }

      const data = await response.json();
      
      if (data.url) {
        // Add state parameter for security
        const state = user.email;
        const notionUrl = new URL(data.url);
        notionUrl.searchParams.append('state', state);
        window.location.href = notionUrl.toString();
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Notion:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect to Notion"
      });
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
      toast({
        title: "Success",
        description: "Successfully disconnected from Notion"
      });
    } catch (error) {
      console.error('Error disconnecting from Notion:', error);
      toast({
        title: "Error",
        description: "Failed to disconnect from Notion"
      });
    }
  };

  const handleNotionPageSelect = async () => {
    if (!user?.email || !selectedNotionPage) return;

    try {
      const selectedPageData = notionPages.find(page => page.id === selectedNotionPage);
      if (!selectedPageData) return;

      // Add Notion step to steps array
      setSteps(prev => [...prev, {
        id: "notion",
        title: "Update Notion",
        type: "notion",
        config: {
          pageId: selectedNotionPage,
          pageTitle: selectedPageData.title,
          workspaceIcon: notionWorkspace?.workspaceIcon || "",
          workspaceId: notionWorkspace?.workspaceId || "",
          workspaceName: notionWorkspace?.workspaceName || "",
          exportNotes: notionExportOptions.notes,
          exportActionItems: notionExportOptions.actionItems
        }
      }]);

      setCurrentStep(null);
      toast({
        title: "Success",
        description: "Successfully added Notion step"
      });
    } catch (error) {
      console.error('Error adding Notion step:', error);
      toast({
        title: "Error",
        description: "Failed to add Notion step"
      });
    }
  };

  const handleSlackConnect = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please sign in to connect Slack"
      });
      return;
    }

    try {
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
      toast({
        title: "Error",
        description: "Failed to connect to Slack"
      });
    }
  };

  const handleChannelSelect = () => {
    if (!selectedChannel) {
      toast({
        title: "Error",
        description: "You must select a Slack channel to continue"
      });
      return;
    }
    
    const newStep: Step = {
      id: "slack",
      title: "Send notes to Slack",
      type: "slack",
      config: {
        channels: [{
          id: selectedChannel,
          name: channels.find(c => c.id === selectedChannel)?.name || '',
          sendNotes: selectedOptions.meetingNotes,
          sendActionItems: selectedOptions.actionItems
        }]
      }
    };
    
    setSteps(prev => [...prev, newStep]);
    setCurrentStep(null);
  };

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
      if (isNotionLoading) {
        return (
          <div className="space-y-8">
            <button
              onClick={() => setCurrentStep(null)}
              className="flex items-center text-muted-foreground hover:text-foreground text-lg transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-2 transform transition-transform group-hover:-translate-x-1" />
              Update Notion
            </button>
            <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
              <h2 className="text-xl font-medium">Loading...</h2>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-8">
          <button
            onClick={() => setCurrentStep(null)}
            className="flex items-center text-muted-foreground hover:text-foreground text-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5 mr-2 transform transition-transform group-hover:-translate-x-1" />
            Update Notion
          </button>
          <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center space-x-4 mb-6">
              <div className="h-10 w-10 flex items-center justify-center">
                {renderIcon(integrationIcons.notion)}
              </div>
              <div>
                <h2 className="text-xl font-medium">
                  {isNotionConnected ? `Connected to ${notionWorkspace?.workspaceName}` : 'Connect Notion'}
                </h2>
                <p className="text-muted-foreground">
                  {isNotionConnected
                    ? 'Configure where to export your meeting content'
                    : 'Connect your Notion account to export meeting content'}
                </p>
              </div>
            </div>

            {!isNotionConnected ? (
              <Button onClick={handleNotionConnect}>Connect Notion</Button>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-3">Select a page or database</h2>
                  <p className="text-muted-foreground mb-4">
                    Choose where you'd like to export your meeting content in Notion.
                  </p>
                  <Select
                    value={selectedNotionPage}
                    onValueChange={setSelectedNotionPage}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a page" />
                    </SelectTrigger>
                    <SelectContent>
                      {notionPages.map(page => (
                        <SelectItem key={page.id} value={page.id}>
                          {page.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h2 className="text-lg font-medium mb-3">Export options</h2>
                  <p className="text-muted-foreground mb-4">Choose what you'd like to export to Notion.</p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Meeting notes</div>
                        <div className="text-sm text-muted-foreground">
                          Export meeting notes to Notion
                        </div>
                      </div>
                      <Switch
                        checked={notionExportOptions.notes}
                        onCheckedChange={(checked) =>
                          setNotionExportOptions(prev => ({ ...prev, notes: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Action items</div>
                        <div className="text-sm text-muted-foreground">
                          Export action items to Notion
                        </div>
                      </div>
                      <Switch
                        checked={notionExportOptions.actionItems}
                        onCheckedChange={(checked) =>
                          setNotionExportOptions(prev => ({ ...prev, actionItems: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleNotionPageSelect}
                  className="mt-8 py-6 text-lg w-full"
                  size="lg"
                  disabled={!selectedNotionPage}
                >
                  Done
                </Button>
              </div>
            )}
          </div>
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
                <Button onClick={handleSlackConnect}>Connect Slack</Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium mb-3">Channel</h2>
                  <p className="text-muted-foreground mb-4">
                    Select the Slack channel you'd like to send your notes to. To select a private channel, add
                    @Descript to it first.
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

    return (
      <div className="space-y-6">
        <div className="border rounded-lg">
          <div className="p-6 border-b">
            <h2 className="text-xl font-medium">Choose what happens</h2>
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
          </div>
        </div>
      </div>
    )
  }

  const saveInsight = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Please sign in to save insights"
      });
      return
    }

    if (!insightName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an insight name"
      });
      return
    }

    if (!insightDescription.trim()) {
      toast({
        title: "Error",
        description: "Please enter a description"
      });
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
      
      toast({
        title: "Success",
        description: "AI Insight step added successfully"
      });
      
      setCurrentStep(null);
    } catch (error) {
      console.error('Error adding insight step:', error)
      toast({
        title: "Error",
        description: "Failed to add insight step"
      });
    }
  }

  const saveAutomation = async () => {
    if (!user?.email) {
      console.error('No user email found');
      toast({
        title: "Error",
        description: "Please sign in to save automation",
        variant: "destructive"
      });
      return;
    }

    if (!automationName.trim()) {
      toast({
        title: "Error",
        description: "Please provide a name for your automation",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      console.log('Starting automation save process...');
      console.log('Current steps:', steps);

      const db = getFirebaseDb();
      
      // Generate a unique ID for the automation document instead of using the name
      const automationsCollectionRef = collection(db, 'integratedautomations', user.email, 'automations');
      const newAutomationDocRef = doc(automationsCollectionRef);
      const automationId = newAutomationDocRef.id;
      
      // Create the automation document with a unique ID but store the name as a field
      await setDoc(newAutomationDocRef, {
        name: automationName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Filter out steps with null type or initial/actions
      const validSteps = steps.filter(step => 
        step.type && step.type !== "initial" && step.type !== "actions"
      );
      
      // Create steps subcollection and save each step with numerical ID
      const stepsCollection = collection(newAutomationDocRef, 'steps');
      
      for (let i = 0; i < validSteps.length; i++) {
        const step = validSteps[i];
        const stepDoc = doc(stepsCollection, i.toString()); // Use numerical index as document ID
        
        // Base step data structure
        const stepData = {
          id: step.type, // This will be 'notion', 'slack', etc.
          type: step.type
        };

        // Add configuration based on step type
        if (step.config) {
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
                channels: step.config.channels?.map((channel: any) => ({
                  id: channel.id || "",
                  name: channel.name || "",
                  sendNotes: channel.sendNotes || false,
                  sendActionItems: channel.sendActionItems || false
                })) || []
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
          }
        }

        // Save the step document
        await setDoc(stepDoc, stepData);
        console.log(`Saved step ${i} of type ${step.type}`);
      }

      console.log('All steps saved successfully');
      toast({
        title: "Automation Created",
        description: `"${automationName}" has been saved successfully`
      });
      
      // Reset the form state
      setIsCreating(false);
      setTriggerStep("initial");
      setSteps([]);
      setSelectedTags([]);
      setAutomationName("");
      
      // Navigate back to the main integrations page
      router.push('/dashboard/integrations');
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({
        title: "Error",
        description: "Failed to save automation",
        variant: "destructive"
      });
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

  return (
    <DashboardLayout>
      <div className="p-8 pt-12 max-w-3xl mx-auto">
        <div className="flex flex-col items-start mb-16">
          <Input
            value={automationName}
            onChange={(e) => setAutomationName(e.target.value)}
            className="text-5xl font-bold bg-transparent border-0 p-0 h-auto w-auto focus-visible:ring-0 tracking-tight leading-none mb-8"
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

