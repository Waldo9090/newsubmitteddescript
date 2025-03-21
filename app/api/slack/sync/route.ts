import { NextResponse } from 'next/server';
import { getAuth } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { meetingId } = await request.json();

    // Get the current user
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get the user's Slack integration details
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', user.email));
    const slackIntegration = userDoc.data()?.slackIntegration;

    if (!slackIntegration?.accessToken || !slackIntegration.channelId) {
      return NextResponse.json({ error: 'Slack not connected or channel not selected' }, { status: 400 });
    }

    // Get meeting data
    const meetingDoc = await getDoc(doc(db, 'transcript', user.email, 'timestamps', meetingId));
    if (!meetingDoc.exists()) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();

    // Format meeting notes and action items
    const actionItems = Object.values(meetingData.actionItems || {})
      .map((item: any) => `• ${item.text}${item.assignee ? ` (Assigned to: ${item.assignee})` : ''}`)
      .join('\n');

    // Create message blocks for Slack
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📝 Meeting Notes: ${meetingData.title || 'Untitled Meeting'}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Notes:*\n' + (meetingData.notes || 'No notes available')
        }
      }
    ];

    if (actionItems) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Action Items:*\n' + actionItems
        }
      });
    }

    // Send message to Slack
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackIntegration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: slackIntegration.channelId,
        blocks,
        text: `Meeting Notes: ${meetingData.title || 'Untitled Meeting'}`, // Fallback text
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Error sending message to Slack:', data);
      return NextResponse.json({ error: 'Failed to send message to Slack' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageTs: data.ts });
  } catch (error) {
    console.error('Error syncing to Slack:', error);
    return NextResponse.json({ error: 'Failed to sync with Slack' }, { status: 500 });
  }
} 