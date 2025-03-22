import { collection, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { Client } from '@notionhq/client';

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
  timestamp: number;
  name: string;
  meetingName: string;
  notes?: string;
  actionItems: string[];
  transcript: string;
}

interface HubSpotConfig {
  contacts: boolean;
  deals: boolean;
  includeMeetingNotes: boolean;
  includeActionItems: boolean;
}

interface AutomationStep {
  type: string;
  config: {
    channels: Array<{
      id: string;
      name: string;
      sendNotes: boolean;
      sendActionItems: boolean;
    }>;
  };
}

export async function exportToNotion(userEmail: string) {
  try {
    console.log('=== Starting Export Process ===');
    console.log('User:', userEmail);
    
    const db = getFirebaseDb();

    // Get the most recent transcript document
    const transcriptRef = collection(db, `transcript/${userEmail}/timestamps`);
    const transcriptQuery = query(transcriptRef, orderBy('timestamp', 'desc'), limit(1));
    const transcriptSnapshot = await getDocs(transcriptQuery);

    if (transcriptSnapshot.empty) {
      throw new Error('No transcript found');
    }

    const transcriptDoc = transcriptSnapshot.docs[0];
    const transcriptData = transcriptDoc.data() as TranscriptData;
    console.log('Found transcript:', {
      id: transcriptDoc.id,
      name: transcriptData.name,
      timestamp: transcriptData.timestamp,
      hasNotes: !!transcriptData.notes,
      actionItemsCount: transcriptData.actionItems?.length
    });

    // Get user document for integration data
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }
    const userData = userDoc.data();

    // Get all documents in the integratedautomations collection for this user
    const automationsRef = collection(db, `integratedautomations/${userEmail}/automations`);
    const automationDocs = await getDocs(automationsRef);

    console.log(`Found ${automationDocs.size} automation documents`);

    // Process each automation document
    for (const automationDoc of automationDocs.docs) {
      console.log(`Processing automation: ${automationDoc.id}`);
      
      // Get all steps for this automation
      const stepsRef = collection(automationDoc.ref, 'steps');
      const stepDocs = await getDocs(stepsRef);

      console.log(`Found ${stepDocs.size} steps`);

      // Process each step
      for (const stepDoc of stepDocs.docs) {
        const stepData = stepDoc.data();
        console.log('Processing step:', {
          id: stepData.id,
          type: stepData.type
        });

        try {
          switch (stepData.type) {
            case 'notion':
              if (userData.notionIntegration) {
                await processNotionStep(transcriptData, userEmail, {
                  pageId: stepData.pageId,
                  pageTitle: stepData.pageTitle,
                  workspaceIcon: stepData.workspaceIcon,
                  workspaceId: stepData.workspaceId,
                  workspaceName: stepData.workspaceName,
                  exportNotes: stepData.exportNotes,
                  exportActionItems: stepData.exportActionItems
                });
              }
              break;

            case 'slack':
              if (userData.slackIntegration) {
                await processSlackStep(transcriptData, userEmail, {
                  channelId: stepData.channelId,
                  channelName: stepData.channelName,
                  sendNotes: stepData.sendNotes,
                  sendActionItems: stepData.sendActionItems,
                  type: stepData.type
                });
              }
              break;

            case 'hubspot':
              if (userData.hubspotIntegration) {
                await processHubSpotStep(transcriptData, userEmail);
              }
              break;

            case 'linear':
              if (userData.linearIntegration) {
                await processLinearStep(transcriptData, userEmail);
              }
              break;

            default:
              console.log(`Unknown step type: ${stepData.type}`);
          }
        } catch (error) {
          console.error(`Error processing step ${stepData.type}:`, error);
          // Continue processing other steps even if one fails
        }
      }
    }

    console.log('=== Export Process Complete ===');
    return true;
  } catch (error) {
    console.error('Error in exportToNotion:', error);
    throw error;
  }
}

async function processNotionStep(transcriptData: TranscriptData, userEmail: string, stepData: NotionConfig) {
  console.log('[Notion Export] Processing Notion step:', {
    hasTranscriptData: !!transcriptData,
    userEmail,
    pageTitle: stepData.pageTitle,
    exportNotes: stepData.exportNotes,
    exportActionItems: stepData.exportActionItems
  });

  try {
    // Get user's Notion access token
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    console.log('[Notion Export] User data:', {
      hasNotionIntegration: !!userData.notionIntegration,
      notionFields: userData.notionIntegration ? Object.keys(userData.notionIntegration) : [],
      hasAccessToken: !!userData.notionIntegration?.accessToken,
      tokenLength: userData.notionIntegration?.accessToken?.length
    });

    const notionIntegration = userData.notionIntegration;

    if (!notionIntegration?.accessToken) {
      throw new Error('Notion access token not found');
    }

    // Verify token with a test API call first
    try {
      const testResponse = await fetch('/api/notion/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: notionIntegration.accessToken
        }),
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.error || 'Failed to verify Notion token');
      }

      console.log('[Notion Export] Token verification successful');
    } catch (error: any) {
      console.error('[Notion Export] Token verification failed:', error);
      throw new Error('Invalid or expired Notion token - please reconnect your Notion account');
    }

    // Prepare blocks array
    const blocks: any[] = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Meeting Details' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ 
            type: 'text', 
            text: { 
              content: `Meeting Time: ${new Date(transcriptData.timestamp).toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
              })}` 
            } 
          }],
        },
      },
    ];

    // Add notes if enabled
    if (stepData.exportNotes && transcriptData.notes) {
      console.log('[Notion Export] Adding notes to blocks...');
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Meeting Notes' } }],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: transcriptData.notes } }],
          },
        }
      );
    }

    // Add action items if enabled
    if (stepData.exportActionItems && transcriptData.actionItems?.length > 0) {
      console.log('[Notion Export] Adding action items to blocks...', {
        actionItemCount: transcriptData.actionItems.length
      });
      
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
          },
        },
        ...transcriptData.actionItems.map((item) => ({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: item } }],
            checked: false,
          },
        }))
      );
    }

    console.log('[Notion Export] Creating Notion page...', {
      pageId: stepData.pageId,
      blockCount: blocks.length,
      hasNotes: stepData.exportNotes && !!transcriptData.notes,
      hasActionItems: stepData.exportActionItems && transcriptData.actionItems?.length > 0
    });

    // Create a new page in Notion through our API
    const response = await fetch('/api/notion/create-page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: notionIntegration.accessToken,
        pageId: stepData.pageId,
        title: transcriptData.name || 'Untitled Meeting',
        blocks: blocks,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create Notion page');
    }

    const data = await response.json();
    console.log('[Notion Export] Page created successfully:', {
      pageId: data.pageId
    });

    return true;
  } catch (error: any) {
    console.error('[Notion Export] Error creating Notion page:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

export async function processSlackStep(
  transcript: TranscriptData,
  userEmail: string,
  stepData: {
    channelId: string;
    channelName: string;
    sendNotes: boolean;
    sendActionItems: boolean;
    type: string;
  }
): Promise<void> {
  console.log('Processing Slack step:', {
    meetingName: transcript.meetingName,
    userEmail,
    hasNotes: !!transcript.notes,
    actionItemsCount: transcript.actionItems?.length,
    channelName: stepData.channelName
  });

  try {
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const slackIntegration = userDoc.data()?.slackIntegration;
    if (!slackIntegration?.teamId || !slackIntegration?.botUserId || !slackIntegration?.botEmail) {
      throw new Error('Slack integration not found or incomplete');
    }

    console.log('Found Slack integration:', {
      teamId: slackIntegration.teamId,
      teamName: slackIntegration.teamName,
      botUserId: slackIntegration.botUserId
    });

    // Get workspace data to use bot token
    const workspaceDoc = await getDoc(doc(db, 'slack_workspaces', slackIntegration.teamId));
    if (!workspaceDoc.exists()) {
      throw new Error('Workspace document not found');
    }

    const workspaceData = workspaceDoc.data();
    const botToken = workspaceData.botAccessToken;

    if (!botToken) {
      throw new Error('Bot token not found');
    }

    // Create message blocks
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📝 ${transcript.meetingName}`,
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain_text',
            text: `Meeting recorded on ${new Date(transcript.timestamp).toLocaleString()}`,
            emoji: true
          }
        ]
      },
      {
        type: 'divider'
      }
    ];

    // Add notes if configured and available
    if (stepData.sendNotes && transcript.notes) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Meeting Notes:*'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: transcript.notes
          }
        },
        {
          type: 'divider'
        }
      );
    }

    // Add action items if configured and available
    if (stepData.sendActionItems && transcript.actionItems?.length > 0) {
      blocks.push(
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Action Items:*'
          }
        }
      );

      transcript.actionItems.forEach((item, index) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${index + 1}. ${item}`
          }
        });
      });
    }

    try {
      console.log(`Sending message to channel ${stepData.channelName} (${stepData.channelId})`);
      
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: stepData.channelId,
          blocks,
          unfurl_links: false,
          unfurl_media: false
        })
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      console.log('Successfully sent message to Slack channel:', stepData.channelName);
    } catch (error) {
      console.error('Error sending message to channel:', stepData.channelName, error);
      throw error;
    }
  } catch (error) {
    console.error('Error in processSlackStep:', error);
    throw error;
  }
}

async function processHubSpotStep(transcriptData: any, userEmail: string) {
  console.log('[HubSpot Export] Processing HubSpot step:', {
    hasTranscriptData: !!transcriptData,
    userEmail
  });
  // Implementation to be added
  return true;
}

async function processLinearStep(transcriptData: any, userEmail: string) {
  console.log('[Linear Export] Processing Linear step:', {
    hasTranscriptData: !!transcriptData,
    userEmail
  });
  // Implementation to be added
  return true;
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

async function processSalesforceStep(
  transcriptData: any,
  userEmail: string,
  config: any
) {
  console.log('[Salesforce Export] Processing Salesforce step:', {
    hasTranscriptData: !!transcriptData,
    userEmail,
    config
  });

  // Get user's Salesforce access token
  const db = getFirebaseDb();
  const userDoc = doc(db, 'users', userEmail);
  const userSnapshot = await getDoc(userDoc);

  if (!userSnapshot.exists()) {
    throw new Error('User document not found');
  }

  const userData = userSnapshot.data();
  const salesforceData = userData.salesforce;

  if (!salesforceData?.accessToken || !salesforceData?.instanceUrl) {
    throw new Error('Salesforce access token or instance URL not found');
  }

  // Extract meeting details
  const { title, summary, actionItems, attendees, date } = transcriptData;

  // Create meeting notes in Salesforce
  if (config.includeMeetingNotes) {
    const meetingNote = {
      Subject: title,
      Description: `Summary:\n${summary}\n\nAction Items:\n${actionItems.map((item: string) => `- ${item}`).join('\n')}`,
      ActivityDate: date,
      Type: 'Meeting Notes',
      Status: 'Completed'
    };

    const taskResponse = await fetch(`${salesforceData.instanceUrl}/services/data/v59.0/sobjects/Task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${salesforceData.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(meetingNote)
    });

    if (!taskResponse.ok) {
      throw new Error('Failed to create meeting notes in Salesforce');
    }

    console.log('[Salesforce Export] Created meeting notes');
  }

  // Create action items as tasks
  if (config.includeActionItems && actionItems.length > 0) {
    for (const item of actionItems) {
      const task = {
        Subject: item,
        Description: `From meeting: ${title}\n\nMeeting Summary:\n${summary}`,
        ActivityDate: date,
        Type: 'Action Item',
        Status: 'Not Started',
        Priority: 'Normal'
      };

      const taskResponse = await fetch(`${salesforceData.instanceUrl}/services/data/v59.0/sobjects/Task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${salesforceData.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      });

      if (!taskResponse.ok) {
        throw new Error(`Failed to create action item in Salesforce: ${item}`);
      }
    }

    console.log('[Salesforce Export] Created action items:', {
      count: actionItems.length
    });
  }

  // Update contacts if needed
  if (config.updateContacts && attendees.length > 0) {
    for (const attendee of attendees) {
      // Search for existing contact
      const searchResponse = await fetch(
        `${salesforceData.instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(`SELECT Id FROM Contact WHERE Email = '${attendee.email}'`)}`,
        {
          headers: {
            'Authorization': `Bearer ${salesforceData.accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        console.warn(`Failed to search for contact: ${attendee.email}`);
        continue;
      }

      const searchData = await searchResponse.json();
      
      if (searchData.records.length === 0) {
        // Create new contact
        const contact = {
          FirstName: attendee.name.split(' ')[0],
          LastName: attendee.name.split(' ').slice(1).join(' ') || '(no last name)',
          Email: attendee.email
        };

        const createResponse = await fetch(`${salesforceData.instanceUrl}/services/data/v59.0/sobjects/Contact`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${salesforceData.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(contact)
        });

        if (!createResponse.ok) {
          console.warn(`Failed to create contact: ${attendee.email}`);
        }
      }
    }

    console.log('[Salesforce Export] Updated contacts:', {
      count: attendees.length
    });
  }

  return true;
} 