import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = authHeader.split('Bearer ')[1];
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const slackIntegration = userDoc.data()?.slackIntegration;
    if (!slackIntegration?.teamId) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    // Get workspace data to use bot token
    const workspaceDoc = await getDoc(doc(db, 'slack_workspaces', slackIntegration.teamId));
    if (!workspaceDoc.exists()) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceData = workspaceDoc.data();
    const botToken = workspaceData.botAccessToken;

    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not found' }, { status: 400 });
    }

    console.log('Fetching channels for workspace:', slackIntegration.teamName);

    // Fetch both public and private channels using Slack Web API
    const [publicChannels, privateChannels] = await Promise.all([
      fetch('https://slack.com/api/conversations.list?types=public_channel&limit=1000', {
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        }
      }),
      fetch('https://slack.com/api/conversations.list?types=private_channel&limit=1000', {
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        }
      })
    ]);

    if (!publicChannels.ok || !privateChannels.ok) {
      console.error('Failed to fetch channels:', {
        publicStatus: publicChannels.status,
        privateStatus: privateChannels.status
      });
      throw new Error('Failed to fetch channels from Slack API');
    }

    const [publicData, privateData] = await Promise.all([
      publicChannels.json(),
      privateChannels.json()
    ]);
    
    if (!publicData.ok || !privateData.ok) {
      console.error('Slack API error:', {
        publicError: publicData.error,
        privateError: privateData.error
      });
      throw new Error(publicData.error || privateData.error || 'Slack API error');
    }

    // Combine and format all channels
    const allChannels = [
      ...(publicData.channels || []),
      ...(privateData.channels || [])
    ]
      .filter(channel => !channel.is_archived) // Filter out archived channels
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isMember: channel.is_member,
        numMembers: channel.num_members
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort channels alphabetically

    console.log('Returning channels:', {
      total: allChannels.length,
      public: publicData.channels?.length || 0,
      private: privateData.channels?.length || 0
    });

    return NextResponse.json({ channels: allChannels });
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 