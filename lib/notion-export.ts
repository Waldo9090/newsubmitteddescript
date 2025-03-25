import { collection, query, orderBy, limit, getDocs, doc, getDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
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
  id: string;
}

interface TranscriptData {
  timestamp: number;
  name: string;
  meetingName: string;
  notes?: string;
  actionItems: ActionItem[];
  transcript: string;
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
                await processHubSpotStep(transcriptData, userEmail, stepData as {
                  accountType: string;
                  contacts: boolean;
                  deals: boolean;
                  id: string;
                  includeActionItems: boolean;
                  includeMeetingNotes: boolean;
                  portalId: string;
                  type: string;
                });
              }
              break;

            case 'linear':
              if (userData.linearIntegration) {
                await processLinearStep(transcriptData, userEmail, stepData as { teamId: string; teamName: string });
              }
              break;

            case 'monday':
              if (userData.mondayIntegration) {
                await processMondayStep(transcriptData, userEmail, stepData as { 
                  board: string;
                  boardName: string;
                  group: string;
                  groupName: string;
                  id: string;
                  type: string;
                });
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
        actionItemCount: transcriptData.actionItems.length,
        actionItems: transcriptData.actionItems
      });
      
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
          },
        }
      );

      // Add each action item as a to_do block
      transcriptData.actionItems.forEach((item) => {
        blocks.push({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ 
              type: 'text', 
              text: { 
                content: item.title
              } 
            }],
            checked: item.done,
          },
        });
        
        // Add description as a paragraph block if it exists
        if (item.description) {
          blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ 
                type: 'text', 
                text: { 
                  content: item.description 
                } 
              }],
            },
          });
        }
      });
    }

    console.log('[Notion Export] Creating Notion page...', {
      pageId: stepData.pageId,
      blockCount: blocks.length,
      hasNotes: stepData.exportNotes && !!transcriptData.notes,
      hasActionItems: stepData.exportActionItems && transcriptData.actionItems?.length > 0,
      blocks: blocks
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
        // Add title
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${index + 1}. ${item.title} ${item.done ? '✅' : ''}`
          }
        });

        // Add description if it exists
        if (item.description) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `   _${item.description}_`
            }
          });
        }
      });
    }

    try {
      console.log(`Sending message to channel ${stepData.channelName} (${stepData.channelId})`);
      
      const response = await fetch('/api/slack/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: stepData.channelId,
          blocks,
          botToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
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

async function processHubSpotStep(transcriptData: TranscriptData, userEmail: string, stepData: {
  accountType: string;
  contacts: boolean;
  deals: boolean;
  id: string;
  includeActionItems: boolean;
  includeMeetingNotes: boolean;
  portalId: string;
  type: string;
}) {
  console.log('[HubSpot Export] Processing HubSpot step:', {
    hasTranscriptData: !!transcriptData,
    userEmail,
    stepConfig: stepData
  });

  try {
    // Get user's HubSpot integration data for authentication
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const hubspotData = userDoc.data()?.hubspotIntegration;

    if (!hubspotData?.accessToken || !hubspotData?.refreshToken) {
      throw new Error('HubSpot authentication tokens not found');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = new Date(hubspotData.expiresAt).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (now >= expiresAt - fiveMinutes) {
      console.log('[HubSpot Export] Token expired or expiring soon, refreshing...');
      
      // Refresh the token
      const response = await fetch('/api/hubspot/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: hubspotData.refreshToken,
          userEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh HubSpot token');
      }

      const { accessToken } = await response.json();
      hubspotData.accessToken = accessToken;
    }

    // Prepare meeting content based on configuration
    let meetingContent = '';
    if (stepData.includeMeetingNotes && transcriptData.notes) {
      meetingContent += `Meeting Notes:\n${transcriptData.notes}\n\n`;
    }

    if (stepData.includeActionItems && transcriptData.actionItems?.length > 0) {
      meetingContent += 'Action Items:\n';
      transcriptData.actionItems.forEach((item: ActionItem) => {
        meetingContent += `- ${item.title}\n`;
        if (item.description) {
          meetingContent += `  ${item.description}\n`;
        }
      });
    }

    // Get timestamp in ISO format
    let meetingDate: string;
    const timestamp = transcriptData.timestamp;
    
    interface FirestoreTimestamp {
      seconds: number;
      nanoseconds: number;
    }

    function isFirestoreTimestamp(value: any): value is FirestoreTimestamp {
      return typeof value === 'object' && value !== null && 
             'seconds' in value && typeof value.seconds === 'number' &&
             'nanoseconds' in value && typeof value.nanoseconds === 'number';
    }

    if (isFirestoreTimestamp(timestamp)) {
      // Firestore timestamp
      meetingDate = new Date(timestamp.seconds * 1000).toISOString();
    } else if (typeof timestamp === 'number') {
      // Unix timestamp in milliseconds
      meetingDate = new Date(timestamp).toISOString();
    } else {
      // Fallback to current time
      meetingDate = new Date().toISOString();
    }

    // Create engagement in HubSpot
    const engagementResponse = await fetch('/api/hubspot/create-engagement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessToken: hubspotData.accessToken,
        portalId: stepData.portalId,
        accountType: stepData.accountType,
        contacts: stepData.contacts,
        deals: stepData.deals,
        meetingName: transcriptData.name || 'Meeting',
        meetingDate,
        content: meetingContent
      })
    });

    if (!engagementResponse.ok) {
      const error = await engagementResponse.json();
      throw new Error(error.message || 'Failed to create HubSpot engagement');
    }

    console.log('[HubSpot Export] Successfully created engagement');
    return true;
  } catch (error) {
    console.error('[HubSpot Export] Error:', error);
    throw error;
  }
}

async function processLinearStep(transcriptData: TranscriptData, userEmail: string, stepData: { teamId: string; teamName: string }) {
  console.log('=== Starting Linear Step Processing ===');
  console.log('Processing Linear step for:', {
    userEmail,
    meetingName: transcriptData.name,
    timestamp: transcriptData.timestamp,
    teamId: stepData.teamId,
    teamName: stepData.teamName
  });
  
  try {
    // Get user's Linear integration data from Firestore
    console.log('Fetching Linear integration data from Firestore...');
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const linearIntegration = userDoc.data()?.linearIntegration;

    console.log('Linear integration data:', {
      hasIntegration: !!linearIntegration,
      hasAccessToken: !!linearIntegration?.accessToken,
      tokenType: linearIntegration?.tokenType,
      scope: linearIntegration?.scope,
      userId: linearIntegration?.userId,
      userName: linearIntegration?.userName
    });

    if (!linearIntegration?.accessToken) {
      console.error('No Linear access token found in user document');
      return;
    }

    // Extract action items from transcript data
    console.log('Extracting action items from transcript:', {
      hasActionItems: !!transcriptData.actionItems,
      actionItemCount: transcriptData.actionItems?.length || 0
    });

    const actionItems = transcriptData.actionItems || [];
    if (actionItems.length === 0) {
      console.log('No action items found in transcript data');
      return;
    }

    console.log(`Found ${actionItems.length} action items to process:`, 
      actionItems.map(item => ({
        id: item.id,
        title: item.title,
        hasDescription: !!item.description,
        done: item.done
      }))
    );

    // Create issues for each action item
    for (const actionItem of actionItems) {
      console.log(`Processing action item: ${actionItem.title}`);
      
      try {
        console.log('Creating Linear issue with data:', {
          teamId: stepData.teamId,
          title: actionItem.title,
          descriptionLength: actionItem.description?.length || 0
        });

        const response = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${linearIntegration.accessToken}`
          },
          body: JSON.stringify({
            query: `
              mutation CreateIssue($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                  success
                  issue {
                    id
                    identifier
                    url
                    title
                    description
                  }
                }
              }
            `,
            variables: {
              input: {
                teamId: stepData.teamId,
                title: actionItem.title,
                description: `${actionItem.description}\n\nCreated from meeting: ${transcriptData.name || 'Untitled Meeting'}\nTimestamp: ${new Date(transcriptData.timestamp).toLocaleString()}`,
                priority: 2
              }
            }
          })
        });

        const data = await response.json();
        console.log('Linear API response:', {
          status: response.status,
          ok: response.ok,
          hasErrors: !!data.errors,
          errors: data.errors,
          success: data.data?.issueCreate?.success,
          issueData: data.data?.issueCreate?.issue
        });
        
        if (data.errors) {
          console.error('Error creating Linear issue:', {
            errors: data.errors,
            actionItem: actionItem.title
          });
          continue;
        }

        if (data.data?.issueCreate?.success) {
          console.log('Successfully created Linear issue:', {
            identifier: data.data.issueCreate.issue.identifier,
            url: data.data.issueCreate.issue.url,
            title: data.data.issueCreate.issue.title
          });
        }
      } catch (error) {
        console.error('Error creating Linear issue for action item:', {
          actionItem: actionItem.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    console.log('=== Linear Step Processing Complete ===');
  } catch (error) {
    console.error('Fatal error in processLinearStep:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userEmail,
      meetingName: transcriptData.name
    });
    throw error;
  }
}

async function processMondayStep(transcriptData: TranscriptData, userEmail: string, stepData: { 
  board: string;
  boardName: string;
  group: string;
  groupName: string;
  id: string;
  type: string;
}) {
  console.log('=== Starting Monday.com Step Processing ===');
  console.log('Processing Monday.com step for:', {
    userEmail,
    meetingName: transcriptData.name,
    timestamp: transcriptData.timestamp,
    board: stepData.board,
    boardName: stepData.boardName,
    group: stepData.group,
    groupName: stepData.groupName
  });
  
  try {
    // Get user's Monday.com integration data from Firestore
    console.log('Fetching Monday.com integration data from Firestore...');
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const mondayIntegration = userDoc.data()?.mondayIntegration;

    console.log('Monday.com integration data:', {
      hasIntegration: !!mondayIntegration,
      hasAccessToken: !!mondayIntegration?.accessToken,
      workspaceId: mondayIntegration?.workspaceId,
      workspaceName: mondayIntegration?.workspaceName
    });

    if (!mondayIntegration?.accessToken) {
      console.error('No Monday.com access token found in user document');
      return;
    }

    // Extract action items from transcript data
    console.log('Extracting action items from transcript:', {
      hasActionItems: !!transcriptData.actionItems,
      actionItemCount: transcriptData.actionItems?.length || 0
    });

    const actionItems = transcriptData.actionItems || [];
    if (actionItems.length === 0) {
      console.log('No action items found in transcript data');
      return;
    }

    console.log(`Found ${actionItems.length} action items to process:`, 
      actionItems.map(item => ({
        id: item.id,
        title: item.title,
        hasDescription: !!item.description,
        done: item.done
      }))
    );

    // Create items for each action item
    for (const actionItem of actionItems) {
      console.log(`Processing action item: ${actionItem.title}`);
      
      try {
        // Format the item name and description
        const itemName = actionItem.title;
        const itemDescription = actionItem.description ? 
          `${actionItem.description}\n\n` : '';
        const meetingInfo = `Created from meeting: ${transcriptData.name || 'Untitled Meeting'}\nDate: ${new Date(transcriptData.timestamp).toLocaleString()}`;
        const formattedDescription = `${itemDescription}${meetingInfo}`;
        
        console.log('Creating Monday.com item with data:', {
          board: stepData.board,
          group: stepData.group,
          itemName: itemName
        });

        // Create the item using the Monday.com API
        const query = `
          mutation {
            create_item (
              board_id: ${stepData.board},
              group_id: "${stepData.group}",
              item_name: "${itemName.replace(/"/g, '\\"')}"
            ) {
              id
            }
          }
        `;

        const response = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": mondayIntegration.accessToken
          },
          body: JSON.stringify({ query })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error creating Monday.com item:', errorText);
          continue;
        }

        const data = await response.json();
        
        if (data.errors) {
          console.error('Error creating Monday.com item:', data.errors);
          continue;
        }

        const itemId = data.data?.create_item?.id;
        
        if (!itemId) {
          console.error('Failed to get item ID from Monday.com response');
          continue;
        }

        console.log('Successfully created Monday.com item:', {
          itemId: itemId,
          title: itemName
        });

        // If the item was created successfully, update it with the description
        // First, we need to find a text column to add the description to
        const columnsQuery = `
          query {
            boards (ids: ${stepData.board}) {
              columns {
                id
                title
                type
              }
            }
          }
        `;

        const columnsResponse = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": mondayIntegration.accessToken
          },
          body: JSON.stringify({ query: columnsQuery })
        });

        if (!columnsResponse.ok) {
          console.error('Failed to fetch columns');
          continue;
        }

        const columnsData = await columnsResponse.json();
        const columns = columnsData.data?.boards[0]?.columns || [];
        
        // Find a suitable text column for the description
        const textColumn = columns.find((col: any) => 
          ['text', 'long-text'].includes(col.type.toLowerCase()) && 
          ['description', 'notes', 'details'].some(term => col.title.toLowerCase().includes(term))
        );
        
        // And a status column for completion status
        const statusColumn = columns.find((col: any) => 
          col.type.toLowerCase() === 'status' ||
          ['status', 'state'].some(term => col.title.toLowerCase().includes(term))
        );

        // Update columns if found
        if (textColumn || statusColumn) {
          const mutations = [];
          
          if (textColumn && formattedDescription) {
            mutations.push(`
              change_column_value (
                board_id: ${stepData.board},
                item_id: ${itemId},
                column_id: "${textColumn.id}",
                value: ${JSON.stringify(JSON.stringify({ text: formattedDescription }))}
              ) {
                id
              }
            `);
          }
          
          if (statusColumn && actionItem.done) {
            mutations.push(`
              change_column_value (
                board_id: ${stepData.board},
                item_id: ${itemId},
                column_id: "${statusColumn.id}",
                value: ${JSON.stringify(JSON.stringify({ index: 1 }))}
              ) {
                id
              }
            `);
          }
          
          if (mutations.length > 0) {
            const updateQuery = `
              mutation {
                ${mutations.join('\n')}
              }
            `;

            const updateResponse = await fetch("https://api.monday.com/v2", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": mondayIntegration.accessToken
              },
              body: JSON.stringify({ query: updateQuery })
            });
            
            if (!updateResponse.ok) {
              console.error('Failed to update item columns');
            } else {
              console.log('Successfully updated item columns');
            }
          }
        }
      } catch (error) {
        console.error('Error creating Monday.com item for action item:', {
          actionItem: actionItem.title,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    console.log('=== Monday.com Step Processing Complete ===');
  } catch (error) {
    console.error('Fatal error in processMondayStep:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userEmail,
      meetingName: transcriptData.name
    });
    throw error;
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