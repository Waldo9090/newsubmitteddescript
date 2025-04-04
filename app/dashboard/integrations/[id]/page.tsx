"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Zap, X } from "lucide-react"
import { getFirebaseDb } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"

interface Automation {
  id: string;
  name: string;
  steps: {
    [key: string]: any;
  };
}

interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  type: 'page' | 'database';
}

interface Step {
  id: string;
  type: string;
  name?: string;
  config?: any;
}

interface SavedAutomation {
  id: string;
  name: string;
  steps: Step[];
  createdAt: number;
}

const integrationIcons: Record<string, { name: string; iconUrl: string; color: string }> = {
  "ai-insights": {
    name: "AI Insights",
    iconUrl: "/icons/integrations/ai-insights.svg",
    color: "#6366F1",
  },
  "slack": {
    name: "Slack",
    iconUrl: "/icons/integrations/slack.svg",
    color: "#E01E5A",
  },
  "notion": {
    name: "Notion",
    iconUrl: "/icons/integrations/notion.svg",
    color: "#000000",
  },
  "linear": {
    name: "Linear",
    iconUrl: "/icons/integrations/linear.svg",
    color: "#5E6AD2",
  },
  "hubspot": {
    name: "HubSpot",
    iconUrl: "/icons/integrations/hubspot.svg",
    color: "#FF7A59",
  },
  "monday": {
    name: "Monday",
    iconUrl: "/icons/integrations/monday.svg",
    color: "#0073EA",
  },
  "attio": {
    name: "Attio",
    iconUrl: "/icons/integrations/attio.svg",
    color: "#000000",
  },
  "salesforce": {
    name: "Salesforce",
    iconUrl: "/icons/integrations/salesforce.svg",
    color: "#00A1E0",
  }
};

export default function AutomationDetailsPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [automation, setAutomation] = useState<SavedAutomation | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; isPrivate?: boolean }>>([])
  const [notionPages, setNotionPages] = useState<NotionPage[]>([])
  const { toast } = useToast()

  // Add states for Slack preferences
  const [selectedChannel, setSelectedChannel] = useState("")
  const [slackOptions, setSlackOptions] = useState({
    sendNotes: true,
    sendActionItems: true
  })

  // Add states for Notion preferences
  const [selectedPage, setSelectedPage] = useState("")
  const [notionOptions, setNotionOptions] = useState({
    exportNotes: true,
    exportActionItems: true
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchAutomation = async () => {
      if (!user?.email) return
      
      try {
        setLoading(true)
        const db = getFirebaseDb()
        
        // Get automation document
        const automationRef = doc(db, 'integratedautomations', user.email, 'automations', id)
        const automationDoc = await getDoc(automationRef)
        
        if (!automationDoc.exists()) {
          toast({
            title: "Error",
            description: "Automation not found"
          })
          router.push('/dashboard/integrations')
          return
        }
        
        // Get steps subcollection
        const stepsRef = collection(automationRef, 'steps')
        const stepsSnap = await getDocs(stepsRef)
        
        const steps: Step[] = []
        stepsSnap.forEach(stepDoc => {
          steps.push({
            id: stepDoc.id,
            type: stepDoc.data().type || 'unknown',
            name: stepDoc.data().name,
            config: stepDoc.data().config || {}
          })
        })
        
        setAutomation({
          id: automationDoc.id,
          name: automationDoc.data().name || 'Untitled Integration',
          steps,
          createdAt: automationDoc.data().createdAt?.seconds * 1000 || Date.now(),
        })
        
        // Fetch available tags for step editing
        const tagsDocRef = doc(db, 'tags', user.email)
        const tagsDocSnap = await getDoc(tagsDocRef)
        
        if (tagsDocSnap.exists()) {
          const tags = tagsDocSnap.data().tags || []
          setAvailableTags(tags)
        }

        // Fetch Slack channels if needed
        const userDoc = await getDoc(doc(db, 'users', user.email))
        const slackIntegration = userDoc.data()?.slackIntegration
        if (slackIntegration?.accessToken) {
          const response = await fetch('/api/slack/channels', {
            headers: {
              'Authorization': `Bearer ${user.email}`
            }
          })
          const data = await response.json()
          if (data.channels) {
            setChannels(data.channels)
          }
        }

        // Fetch Notion pages if needed
        const notionIntegration = userDoc.data()?.notionIntegration
        if (notionIntegration?.accessToken) {
          const response = await fetch('/api/notion/pages', {
            headers: {
              'Authorization': `Bearer ${user.email}`
            }
          })
          const data = await response.json()
          if (data.pages) {
            setNotionPages(data.pages)
          }
        }
      } catch (error) {
        console.error('Error fetching automation:', error)
        toast({
          title: "Error",
          description: "Failed to load automation details"
        })
      } finally {
        setLoading(false)
      }
    }
    
    fetchAutomation()
  }, [user?.email, id, router, toast])

  // Function to handle step updates
  const handleStepUpdate = async (stepId: string, updatedData: any) => {
    if (!user?.email || !automation) return;

    try {
      const db = getFirebaseDb();
      const stepRef = doc(db, 'integratedautomations', user.email, 'automations', automation.id, 'steps', stepId);
      await updateDoc(stepRef, updatedData);
      
      // Update local state
      setAutomation(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          steps: prev.steps.map(step =>
            step.id === stepId ? { ...step, ...updatedData } : step
          )
        };
      });

      toast({
        title: "Success",
        description: "Step updated successfully"
      });
      
      // Reset editing state
      setEditingStep(null);
    } catch (error) {
      console.error('Error updating step:', error);
      toast({
        title: "Error",
        description: "Failed to update step"
      });
    }
  };

  // Function to render step details
  const renderStepDetails = (stepId: string, step: Step) => {
    const isEditing = editingStep === stepId;

    if (step.type === 'trigger' && isEditing) {
      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-medium">Trigger</h2>
            </div>
            <Button variant="ghost" onClick={() => setEditingStep(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-4">When to run</h3>
            <div className="bg-muted/30 p-6 rounded-lg space-y-4">
              {step.config?.tags?.map((tag: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <span>{tag}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-auto"
                    onClick={() => {
                      const newTags = step.config?.tags.filter((_: string, i: number) => i !== index);
                      handleStepUpdate(stepId, { config: { ...step.config, tags: newTags } });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (step.type === 'slack' && isEditing) {
      // Set initial values when editing starts
      useEffect(() => {
        if (isEditing && step.type === 'slack') {
          setSelectedChannel(step.config?.channelId || "")
          setSlackOptions({
            sendNotes: step.config?.sendNotes ?? true,
            sendActionItems: step.config?.sendActionItems ?? true
          })
        }
      }, [isEditing])

      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/icons/integrations/slack.svg" alt="Slack" width={24} height={24} />
              <h2 className="text-xl font-medium">Send notes to Slack</h2>
            </div>
            <Button variant="ghost" onClick={() => setEditingStep(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Channel</h3>
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
              <h3 className="text-lg font-medium mb-3">What to include</h3>
              <p className="text-muted-foreground mb-4">Choose what you'd like to send to Slack.</p>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="send-notes"
                    checked={slackOptions.sendNotes}
                    onCheckedChange={(checked) =>
                      setSlackOptions(prev => ({ ...prev, sendNotes: checked as boolean }))
                    }
                  />
                  <Label htmlFor="send-notes">Meeting notes</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="send-action-items"
                    checked={slackOptions.sendActionItems}
                    onCheckedChange={(checked) =>
                      setSlackOptions(prev => ({ ...prev, sendActionItems: checked as boolean }))
                    }
                  />
                  <Label htmlFor="send-action-items">Action items</Label>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => handleStepUpdate(stepId, {
                config: {
                  ...step.config,
                  channelId: selectedChannel,
                  channelName: channels.find(c => c.id === selectedChannel)?.name,
                  sendNotes: slackOptions.sendNotes,
                  sendActionItems: slackOptions.sendActionItems
                }
              })}
              className="w-full"
            >
              Save Changes
            </Button>
          </div>
        </div>
      );
    }

    if (step.type === 'notion' && isEditing) {
      // Set initial values when editing starts
      useEffect(() => {
        if (isEditing && step.type === 'notion') {
          setSelectedPage(step.config?.pageId || "")
          setNotionOptions({
            exportNotes: step.config?.exportNotes ?? true,
            exportActionItems: step.config?.exportActionItems ?? true
          })
        }
      }, [isEditing])

      return (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/icons/integrations/notion.svg" alt="Notion" width={24} height={24} />
              <h2 className="text-xl font-medium">Export to Notion</h2>
            </div>
            <Button variant="ghost" onClick={() => setEditingStep(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Select Page</h3>
              <p className="text-muted-foreground mb-4">
                Choose where to export your meeting content
              </p>
              <Select 
                value={selectedPage}
                onValueChange={setSelectedPage}
              >
                <SelectTrigger className="w-[300px]">
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
              <h3 className="text-lg font-medium mb-3">What to include</h3>
              <p className="text-muted-foreground mb-4">Choose what you'd like to export to Notion</p>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="export-notes"
                    checked={notionOptions.exportNotes}
                    onCheckedChange={(checked) =>
                      setNotionOptions(prev => ({ ...prev, exportNotes: checked as boolean }))
                    }
                  />
                  <Label htmlFor="export-notes">Meeting notes</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="export-action-items"
                    checked={notionOptions.exportActionItems}
                    onCheckedChange={(checked) =>
                      setNotionOptions(prev => ({ ...prev, exportActionItems: checked as boolean }))
                    }
                  />
                  <Label htmlFor="export-action-items">Action items</Label>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => handleStepUpdate(stepId, {
                config: {
                  ...step.config,
                  pageId: selectedPage,
                  pageTitle: notionPages.find(p => p.id === selectedPage)?.title,
                  exportNotes: notionOptions.exportNotes,
                  exportActionItems: notionOptions.exportActionItems
                }
              })}
              className="w-full"
            >
              Save Changes
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div 
        key={stepId}
        className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border cursor-pointer"
        onClick={() => setEditingStep(stepId)}
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {step.type === 'trigger' && <Zap className="h-6 w-6 text-primary" />}
          {step.type === 'slack' && <Image src="/icons/integrations/slack.svg" alt="Slack" width={24} height={24} />}
          {step.type === 'notion' && <Image src="/icons/integrations/notion.svg" alt="Notion" width={24} height={24} />}
          {step.type === 'linear' && <Image src="/icons/integrations/linear.svg" alt="Linear" width={24} height={24} />}
          {step.type === 'hubspot' && <Image src="/icons/integrations/hubspot.svg" alt="HubSpot" width={24} height={24} />}
          {step.type === 'monday' && <Image src="/icons/integrations/monday.svg" alt="Monday" width={24} height={24} />}
          {step.type === 'attio' && <Image src="/icons/integrations/attio.svg" alt="Attio" width={24} height={24} />}
          {step.type === 'salesforce' && <Image src="/icons/integrations/salesforce.svg" alt="Salesforce" width={24} height={24} />}
          {step.type === 'ai-insights' && <Image src="/icons/integrations/ai-insights.svg" alt="AI Insights" width={24} height={24} />}
        </div>
        <span className="font-medium text-lg">
          {step.type === 'trigger' && `After every meeting with tags: ${step.config?.tags?.join(", ") || "any"}`}
          {step.type === 'slack' && "Send notes to Slack"}
          {step.type === 'notion' && "Update Notion"}
          {step.type === 'linear' && "Create Linear tasks"}
          {step.type === 'hubspot' && "Update HubSpot"}
          {step.type === 'monday' && "Sync with Monday"}
          {step.type === 'attio' && "Sync with Attio"}
          {step.type === 'salesforce' && "Sync with Salesforce"}
          {step.type === 'ai-insights' && "Generate insights with AI"}
        </span>
        <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
      </div>
    );
  };

  if (!mounted) {
    return null // Prevent hydration mismatch by not rendering anything on server
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/integrations')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Automations
          </Button>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded"></div>
          <div className="h-24 w-full bg-muted rounded"></div>
          <div className="h-24 w-full bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/integrations')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Automations
          </Button>
        </div>
        <p>Automation not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/integrations')}>
          <ChevronLeft className="h-4 w-4" />
          Back to Automations
        </Button>
      </div>
      
      <h1 className="text-3xl font-semibold mb-6">{automation.name}</h1>
      
      <div className="space-y-6">
        <h2 className="text-xl font-medium mb-4">Steps</h2>
        <div className="space-y-4">
          {automation.steps.map((step) => (
            <div key={step.id} className="mb-6">
              {renderStepDetails(step.id, step)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 