import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export async function POST(request: Request) {
  try {
    const { meetingId, targetPageId } = await request.json();

    // Get the current user
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get the user's Notion integration details
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', user.email));
    const notionIntegration = userDoc.data()?.notionIntegration;

    if (!notionIntegration?.accessToken) {
      return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }

    // Get meeting data
    const meetingDoc = await getDoc(doc(db, 'transcript', user.email, 'timestamps', meetingId));
    if (!meetingDoc.exists()) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();

    // Initialize Notion client
    const notion = new Client({
      auth: notionIntegration.accessToken,
    });

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
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Action Items' } }],
          },
        },
        ...Object.values(meetingData.actionItems || {}).map((item: any) => ({
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [{ type: 'text' as const, text: { content: item.text } }],
            checked: item.completed || false,
          },
        }))
      );
    }

    // Create a new page in Notion
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

    return NextResponse.json({ success: true, pageId: response.id });
  } catch (error) {
    console.error('Error syncing to Notion:', error);
    return NextResponse.json({ error: 'Failed to sync with Notion' }, { status: 500 });
  }
} 