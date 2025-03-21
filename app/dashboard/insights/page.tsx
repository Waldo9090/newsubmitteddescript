"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface InsightResponse {
  content: string;
  meeting: string;
  date: any; // Could be a Date object or a timestamp
}

interface Insight {
  id: string;
  name: string;
  description: string;
  automationName: string;
  automationId: string;
  responsesCount: number;
  responses: InsightResponse[];
}

export default function InsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);
        const db = getFirebaseDb();
        
        // Get all automations for the user
        const automationsRef = collection(db, 'integratedautomations', user.email, 'automations');
        const automationsSnapshot = await getDocs(automationsRef);
        
        const loadedInsights: Insight[] = [];
        
        // Process each automation
        for (const automationDoc of automationsSnapshot.docs) {
          const automationName = automationDoc.data().name || 'Untitled Automation';
          
          // Get all steps for this automation
          const stepsRef = collection(automationDoc.ref, 'steps');
          const stepsSnapshot = await getDocs(stepsRef);
          
          // Find AI insight steps
          for (const stepDoc of stepsSnapshot.docs) {
            const stepData = stepDoc.data();
            
            // Log the step data to debug
            console.log('Found step:', {
              id: stepDoc.id,
              type: stepData.type,
              stepData: stepData
            });
            
            // Check if this is an AI insights step
            if (stepData.id === 'ai-insights' || stepData.type === 'ai-insights') {
              // Get response data
              const responses = stepData.responses || [];
              
              // Try to find the name - there might be different field names used
              const insightName = stepData.name || stepData.title || stepData.insightName || stepData.config?.name || '';
              
              // Try to find the description
              const insightDescription = stepData.description || stepData.desc || stepData.config?.description || '';
              
              // Log the insight data with full stepData object for debugging
              console.log('Found AI insight step:', {
                stepDoc: stepDoc.id,
                stepData: JSON.stringify(stepData, null, 2),
                name: insightName,
                description: insightDescription,
                responsesCount: responses.length
              });
              
              loadedInsights.push({
                id: stepDoc.id,
                name: insightName || 'Unnamed Insight',
                description: insightDescription || '',
                automationName: automationName,
                automationId: automationDoc.id,
                responsesCount: responses.length,
                responses: responses.map((response: any) => ({
                  content: response.content || '',
                  meeting: response.meeting || '',
                  date: response.date ? (response.date.toDate ? response.date.toDate() : new Date(response.date)) : new Date()
                }))
              });
            }
          }
        }
        
        setInsights(loadedInsights);
      } catch (error) {
        console.error('Error loading insights from automations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInsights();
  }, [user?.email]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">AI Insights</h1>
        <div className="text-center py-8">Loading insights...</div>
      </div>
    );
  }

  if (selectedInsight) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">
              {selectedInsight.name || `Insight #${selectedInsight.id}`}
            </h1>
            <p className="text-muted-foreground mt-1">
              {selectedInsight.description || 'No description provided'}
            </p>
          </div>
          <button 
            onClick={() => setSelectedInsight(null)}
            className="text-sm text-primary hover:underline"
          >
            Back to insights
          </button>
        </div>

        {selectedInsight.responses.length > 0 ? (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">Insight</th>
                  <th className="text-left p-4">Meeting</th>
                  <th className="text-left p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {selectedInsight.responses.map((response, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    <td className="p-4">{response.content}</td>
                    <td className="p-4">{response.meeting}</td>
                    <td className="p-4">{response.date instanceof Date 
                      ? response.date.toLocaleDateString() 
                      : 'Invalid date'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">No insights have been generated yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Record a meeting to generate insights.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">AI Insights</h1>

      {insights.length > 0 ? (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card 
              key={`${insight.automationId}-${insight.id}`} 
              className="p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => setSelectedInsight(insight)}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">
                    {insight.name || `Insight #${insight.id}`}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {insight.description || 'No description provided'}
                </p>
                <div className="flex items-center gap-1 text-sm text-primary">
                  <span>{insight.responsesCount}</span>
                  <span>insight{insight.responsesCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>{insight.automationName}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground">No AI insights found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Set up an automation with AI insights to get started.
          </p>
        </div>
      )}
    </div>
  );
}

