"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import DashboardLayout from "../../components/DashboardLayout"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Zap, X } from "lucide-react"
import { getFirebaseDb } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"

interface Automation {
  id: string;
  name: string;
  steps: {
    [key: string]: any;
  };
}

export default function AutomationDetailsPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { user } = useAuth()
  const [automation, setAutomation] = useState<Automation | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const { toast } = useToast()

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
        
        const steps: { [key: string]: any } = {}
        stepsSnap.forEach(stepDoc => {
          steps[stepDoc.id] = stepDoc.data()
        })
        
        setAutomation({
          id: automationDoc.id,
          name: automationDoc.data().name || automationDoc.id,
          steps
        })
        
        // Fetch available tags for step editing
        const tagsDocRef = doc(db, 'tags', user.email)
        const tagsDocSnap = await getDoc(tagsDocRef)
        
        if (tagsDocSnap.exists()) {
          const tags = tagsDocSnap.data().tags || []
          setAvailableTags(tags)
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
          steps: {
            ...prev.steps,
            [stepId]: {
              ...prev.steps[stepId],
              ...updatedData
            }
          }
        };
      });

      toast({
        title: "Success",
        description: "Step updated successfully"
      });
    } catch (error) {
      console.error('Error updating step:', error);
      toast({
        title: "Error",
        description: "Failed to update step"
      });
    }
  };

  // Function to render step details
  const renderStepDetails = (stepId: string, step: any) => {
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
              {step.tags?.map((tag: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <span>{tag}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-auto"
                    onClick={() => {
                      const newTags = step.tags.filter((_: string, i: number) => i !== index);
                      handleStepUpdate(stepId, { tags: newTags });
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
          {step.type === 'attio' && <Image src="/icons/integrations/Attio.svg" alt="Attio" width={24} height={24} />}
          {step.type === 'ai-insights' && <Image src="/icons/integrations/ai-insights.svg" alt="AI Insights" width={24} height={24} />}
        </div>
        <span className="font-medium text-lg">
          {step.type === 'trigger' && `After every meeting with tags: ${step.tags?.join(", ") || "any"}`}
          {step.type === 'slack' && "Send notes to Slack"}
          {step.type === 'notion' && "Update Notion"}
          {step.type === 'linear' && "Create Linear tasks"}
          {step.type === 'attio' && "Sync with Attio"}
          {step.type === 'ai-insights' && step.name}
        </span>
        <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
      </div>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  if (!automation) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center mb-6">
            <Button variant="ghost" className="gap-2" onClick={() => router.push('/dashboard/integrations')}>
              <ChevronLeft className="h-4 w-4" />
              Back to Automations
            </Button>
          </div>
          <p>Automation not found.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
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
            {Object.entries(automation.steps)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([stepId, step]) => (
                <div key={stepId} className="mb-6">
                  {renderStepDetails(stepId, step)}
                </div>
              ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 