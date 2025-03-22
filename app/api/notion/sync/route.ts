import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    console.log('[Notion Sync] Starting sync process...');
    
    const { meetingId, targetPageId } = await request.json();
    console.log('[Notion Sync] Received request:', { meetingId, targetPageId });

    // Get user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Notion Sync] Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = authHeader.replace('Bearer ', '');
    console.log('[Notion Sync] User email:', userEmail);

    // Get meeting data first
    console.log('[Notion Sync] Fetching meeting data...');
    const db = getFirebaseDb();
    const meetingDoc = await getDoc(doc(db, 'transcript', userEmail, 'timestamps', meetingId));
    if (!meetingDoc.exists()) {
      console.error('[Notion Sync] Meeting not found:', meetingId);
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();
    console.log('[Notion Sync] Meeting data retrieved:', {
      hasNotes: !!meetingData.notes,
      hasActionItems: !!meetingData.actionItems,
      title: meetingData.title || meetingData.name
    });

    // Get the user's Notion integration details
    console.log('[Notion Sync] Fetching Notion integration details...');
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const notionIntegration = userDoc.data()?.notionIntegration;

    if (!notionIntegration?.accessToken) {
      console.error('[Notion Sync] No Notion access token found');
      return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }
    console.log('[Notion Sync] Found Notion integration');

    // Initialize Notion client
    console.log('[Notion Sync] Initializing Notion client...');
    const notion = new Client({
      auth: notionIntegration.accessToken,
    });

    // First verify the Notion connection is working
    try {
      console.log('[Notion Sync] Verifying Notion connection...');
      const user = await notion.users.me();
      console.log('[Notion Sync] Notion connection verified:', {
        name: user.name,
        type: user.type
      });
    } catch (connectionError: any) {
      console.error('[Notion Sync] Error verifying Notion connection:', connectionError);
      return NextResponse.json({
        error: 'Invalid or expired Notion connection',
        details: 'Please reconnect your Notion account'
      }, { status: 401 });
    }

    // Verify the target page exists and is accessible
    try {
      console.log('[Notion Sync] Verifying target page access...', { targetPageId });
      const page = await notion.pages.retrieve({ page_id: targetPageId });
      console.log('[Notion Sync] Target page is accessible:', {
        pageId: page.id,
        object: page.object
      });
    } catch (pageError: any) {
      console.error('[Notion Sync] Error accessing target page:', {
        pageId: targetPageId,
        error: pageError.message,
        code: pageError.code
      });

      // Check if it's a permissions issue
      if (pageError.code === 'object_not_found' || pageError.status === 404) {
        return NextResponse.json({
          error: 'Cannot find target Notion page',
          details: 'The page may have been deleted or you may not have access to it. Please check the page exists and share it with your integration.'
        }, { status: 404 });
      }

      return NextResponse.json({
        error: 'Cannot access target Notion page',
        details: 'Please make sure you have shared the page with your integration. Go to the page, click Share, and add your integration.'
      }, { status: 403 });
    }

    // Prepare blocks array based on export preferences
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
              content: `Meeting Time: ${new Date(meetingData.timestamp).toLocaleString('en-US', {
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
    if (notionIntegration.exportNotes && meetingData.notes) {
      console.log('[Notion Sync] Adding notes to blocks...');
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
            rich_text: [{ type: 'text', text: { content: meetingData.notes } }],
          },
        }
      );
    }

    // Add action items if enabled
    if (notionIntegration.exportActionItems && meetingData.actionItems) {
      const actionItems = Object.values(meetingData.actionItems || {});
      console.log('[Notion Sync] Adding action items to blocks...', {
        actionItemCount: actionItems.length
      });
      
      if (actionItems.length > 0) {
        blocks.push(
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
            },
          },
          ...actionItems.map((item: any) => ({
            object: 'block' as const,
            type: 'to_do' as const,
            to_do: {
              rich_text: [{ type: 'text' as const, text: { content: item.text } }],
              checked: item.completed || false,
            },
          }))
        );
      }
    }

    console.log('[Notion Sync] Creating Notion page...', {
      targetPageId,
      blockCount: blocks.length,
      hasNotes: blocks.some(b => b.type === 'paragraph'),
      hasActionItems: blocks.some(b => b.type === 'to_do')
    });

    // Create a new page in Notion
    try {
      const response = await notion.pages.create({
        parent: {
          page_id: targetPageId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: meetingData.title || meetingData.name || 'Untitled Meeting',
                },
              },
            ],
          },
        },
        children: blocks,
      });

      console.log('[Notion Sync] Page created successfully:', {
        pageId: response.id
      });

      return NextResponse.json({ 
        success: true, 
        pageId: response.id
      });
    } catch (notionError: any) {
      console.error('[Notion Sync] Error creating Notion page:', {
        error: notionError.message,
        code: notionError.code,
        status: notionError.status
      });
      return NextResponse.json({ 
        error: 'Failed to create Notion page',
        details: notionError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Notion Sync] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to sync with Notion',
      details: error.message
    }, { status: 500 });
  }
} 