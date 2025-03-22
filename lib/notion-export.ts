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
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data();
    const transcriptData = userData.transcriptData as TranscriptData;

    if (!transcriptData) {
      throw new Error('No transcript data found');
    }

    // Get automation configuration from integratedAutomations collection
    const automationDoc = await getDoc(doc(db, 'integratedAutomations', userEmail));
    const automationData = automationDoc.exists() ? automationDoc.data() : null;

    console.log('Fetched automation configuration:', automationData);

    // Process each automation type
    if (userData.notionIntegration) {
      await processNotionStep(transcriptData, userEmail, userData.notionIntegration as NotionConfig);
    }

    // Check for Slack automation in the integratedAutomations collection
    if (automationData?.slack) {
      console.log('Found Slack automation configuration:', automationData.slack);
      await processSlackStep(transcriptData, userEmail, {
        type: 'slack',
        config: {
          channelId: automationData.slack.config.channelId,
          channelName: automationData.slack.config.channelName,
          sendNotes: automationData.slack.config.sendNotes,
          sendActionItems: automationData.slack.config.sendActionItems
        }
      });
    }

    if (userData.hubspotIntegration) {
      await processHubSpotStep(transcriptData, userEmail);
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
  step: {
    type: string;
    config: {
      channelId: string;
      channelName: string;
      sendNotes: boolean;
      sendActionItems: boolean;
    };
  }
): Promise<void> {
  console.log('Processing Slack step:', {
    meetingName: transcript.meetingName,
    userEmail,
    hasNotes: !!transcript.notes,
    actionItemsCount: transcript.actionItems?.length,
    channelName: step.config.channelName
  });

  try {
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const slackIntegration = userDoc.data()?.slackIntegration;
    if (!slackIntegration?.teamId) {
      throw new Error('Slack integration not found');
    }

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
    if (step.config.sendNotes && transcript.notes) {
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
    if (step.config.sendActionItems && transcript.actionItems?.length > 0) {
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
      console.log(`Sending message to channel ${step.config.channelName} (${step.config.channelId})`);
      
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: step.config.channelId,
          blocks,
          unfurl_links: false,
          unfurl_media: false
        })
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      console.log('Successfully sent message to Slack channel:', step.config.channelName);
    } catch (error) {
      console.error('Error sending message to channel:', step.config.channelName, error);
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

export async function processStep(step: string, transcriptData: any, userEmail: string) {
  try {
    console.log('[Process Step] Processing step:', { step, userEmail });

    // Get user document to check configuration
    const db = getFirebaseDb();
    const userDoc = doc(db, 'users', userEmail);
    const userSnapshot = await getDoc(userDoc);

    if (!userSnapshot.exists()) {
      throw new Error('User document not found');
    }

    const userData = userSnapshot.data();

    // Get automation configuration
    const automationDoc = await getDoc(doc(db, 'integratedAutomations', userEmail));
    const automationData = automationDoc.exists() ? automationDoc.data() : null;

    console.log('[Process Step] Automation configuration:', automationData);

    switch (step) {
      case 'notion':
        return await processNotionStep(transcriptData, userEmail, userData.notionIntegration as NotionConfig);
      case 'slack':
        // Check if there's a Slack configuration in the automation
        if (!automationData?.slack) {
          console.log('[Process Step] No Slack configuration found');
          return;
        }

        const slackConfig = automationData.slack.config;
        console.log('[Process Step] Found Slack configuration:', slackConfig);

        // Only process if either notes or action items are enabled
        if (slackConfig.sendNotes || slackConfig.sendActionItems) {
          return await processSlackStep(transcriptData, userEmail, {
            type: 'slack',
            config: {
              channelId: slackConfig.channelId,
              channelName: slackConfig.channelName,
              sendNotes: slackConfig.sendNotes,
              sendActionItems: slackConfig.sendActionItems
            }
          });
        } else {
          console.log('[Process Step] Slack step skipped - neither notes nor action items are enabled');
        }
        break;
      case 'hubspot':
        return await processHubSpotStep(transcriptData, userEmail);
      case 'linear':
        return await processLinearStep(transcriptData, userEmail);
      case 'salesforce':
        return await processSalesforceStep(transcriptData, userEmail, userData.salesforce?.config || {});
      default:
        throw new Error(`Unknown step: ${step}`);
    }
  } catch (error: any) {
    console.error('[Process Step] Error processing step:', {
      step,
      error,
      stack: error?.stack,
      message: error?.message
    });
    throw error;
  }
} 