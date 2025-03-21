import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { user } = await request.json();
    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get meeting data
    const db = getFirebaseDb();
    const meetingDoc = await getDoc(doc(db, 'transcript', user.email, 'timestamps', params.meetingId));
    
    if (!meetingDoc.exists()) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();

    // Get user's Slack integration details
    const userDoc = await getDoc(doc(db, 'users', user.email));
    const slackIntegration = userDoc.data()?.slackIntegration;

    if (!slackIntegration?.accessToken || !slackIntegration.selectedChannels) {
      return NextResponse.json({ error: 'Slack not configured' }, { status: 400 });
    }

    // Format meeting notes and action items
    const actionItems = Object.values(meetingData.actionItems || {})
      .map((item: any) => `• ${item.text}${item.assignee ? ` (Assigned to: ${item.assignee})` : ''}`)
      .join('\n');

    // Get selected channels
    const selectedChannelIds = Object.entries(slackIntegration.selectedChannels)
      .filter(([_, isSelected]) => isSelected)
      .map(([channelId]) => channelId);

    // Send to each selected channel
    const results = await Promise.all(
      selectedChannelIds.map(async (channelId) => {
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

        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackIntegration.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: channelId,
            blocks,
            text: `Meeting Notes: ${meetingData.title || 'Untitled Meeting'}`, // Fallback text
          }),
        });

        const data = await response.json();
        return { channelId, success: data.ok, error: data.error };
      })
    );

    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return NextResponse.json({
        error: 'Some notifications failed',
        details: failures
      }, { status: 207 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending Slack notifications:', error);
    return NextResponse.json({
      error: 'Failed to send notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 