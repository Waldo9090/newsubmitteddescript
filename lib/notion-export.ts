import { collection, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

interface NotionConfig {
  pageId: string;
  pageTitle: string;
  workspaceIcon: string;
  workspaceId: string;
  workspaceName: string;
  exportNotes: boolean;
  exportActionItems: boolean;
}

interface AIInsightsConfig {
  name: string;
  description: string;
  count: string;
}

interface ActionItem {
  title: string;
  description: string;
  done: boolean;
}

interface TranscriptData {
  notes: string;
  actionItems: ActionItem[];
  name: string;
  transcript: string;
  timestamp: number;
}

export async function exportToNotion(userEmail: string) {
  try {
    console.log('=== Starting Export Process ===');
    console.log('User:', userEmail);
    
    const db = getFirebaseDb();

    // Get the most recent transcript
    console.log('Fetching most recent transcript...');
    const transcriptRef = collection(db, 'transcript', userEmail, 'timestamps');
    const q = query(transcriptRef, orderBy('timestamp', 'desc'), limit(1));
    const transcriptSnapshot = await getDocs(q);

    if (transcriptSnapshot.empty) {
      console.log('No transcripts found');
      return;
    }

    const transcriptDoc = transcriptSnapshot.docs[0];
    const transcriptData = transcriptDoc.data() as TranscriptData;
    console.log('Found transcript:', {
      meetingName: transcriptData.name,
      timestamp: transcriptData.timestamp,
      hasNotes: !!transcriptData.notes,
      actionItemsCount: transcriptData.actionItems?.length || 0
    });

    // Get all automations and process steps
    console.log('Fetching automations...');
    const automationsRef = collection(db, 'integratedautomations', userEmail, 'automations');
    const automationsSnapshot = await getDocs(automationsRef);
    
    for (const automationDoc of automationsSnapshot.docs) {
      console.log('Processing automation:', automationDoc.id);
      const stepsCollection = collection(automationDoc.ref, 'steps');
      const stepsSnapshot = await getDocs(stepsCollection);
      
      // Process each step based on its type
      for (const stepDoc of stepsSnapshot.docs) {
        const stepData = stepDoc.data();
        console.log(`Found step: ${stepDoc.id}, type: ${stepData.type}`);
        
        // Process Notion step
        if (stepData.type === 'notion') {
          await processNotionStep(userEmail, stepData, transcriptData);
        }
        
        // Process AI Insights step
        if (stepData.type === 'ai-insights') {
          await processAIInsightsStep(userEmail, stepData, transcriptData, stepDoc.ref);
        }
      }
    }

    console.log('=== Export Process Complete ===');
  } catch (error) {
    console.error('Error in export process:', error);
  }
}

async function processNotionStep(userEmail: string, stepData: any, transcriptData: TranscriptData) {
  try {
    const notionConfig = stepData as NotionConfig;
    console.log('Processing Notion Step:', {
      pageId: notionConfig.pageId,
      workspaceName: notionConfig.workspaceName,
      exportNotes: notionConfig.exportNotes,
      exportActionItems: notionConfig.exportActionItems
    });

    // Get the access token from the user's document
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const accessToken = userDoc.data()?.notionIntegration?.accessToken;
    
    if (!accessToken) {
      console.log('No Notion access token found');
      return;
    }

    // Export to Notion if enabled
    if (notionConfig.exportNotes && transcriptData.notes) {
      console.log('Exporting notes to Notion...');
      try {
        const response = await fetch('/api/notion/create-page', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: notionConfig.pageId,
            content: transcriptData.notes,
            title: `Meeting Notes: ${transcriptData.name}`,
            accessToken
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to export notes: ${response.statusText}`);
        }

        console.log('✅ Successfully exported notes to Notion');
      } catch (error) {
        console.error('Error exporting notes to Notion:', error);
      }
    }

    if (notionConfig.exportActionItems && transcriptData.actionItems?.length > 0) {
      console.log('Exporting action items to Notion...');
      try {
        const actionItemsContent = transcriptData.actionItems
          .map(item => `- [ ] ${item.title}\n   ${item.description}`)
          .join('\n\n');

        const response = await fetch('/api/notion/create-page', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pageId: notionConfig.pageId,
            content: actionItemsContent,
            title: `Action Items: ${transcriptData.name}`,
            accessToken
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to export action items: ${response.statusText}`);
        }

        console.log('✅ Successfully exported action items to Notion');
      } catch (error) {
        console.error('Error exporting action items to Notion:', error);
      }
    }
  } catch (error) {
    console.error('Error processing Notion step:', error);
  }
}

async function processAIInsightsStep(userEmail: string, stepData: any, transcriptData: TranscriptData, stepDocRef: any) {
  try {
    const insightConfig = stepData as AIInsightsConfig;
    console.log('Processing AI Insights Step:', {
      name: insightConfig.name,
      description: insightConfig.description,
      count: insightConfig.count
    });

    if (!transcriptData.transcript) {
      console.log('No transcript text found');
      return;
    }

    // Generate insight using the API
    console.log('Generating insight...');
    const response = await fetch('/api/insights/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: transcriptData.transcript,
        description: insightConfig.description
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const { content } = await response.json();

    if (content) {
      console.log('Generated insight content:', content);

      const newResponse = {
        content,
        meeting: transcriptData.name,
        date: new Date()
      };

      // Update the step document with the new response
      await updateDoc(stepDocRef, {
        responses: arrayUnion(newResponse)
      });

      console.log(`✅ Successfully saved insight for "${insightConfig.name}" from meeting "${transcriptData.name}"`);
    }
  } catch (error) {
    console.error('Error processing AI Insights step:', error);
  }
} 