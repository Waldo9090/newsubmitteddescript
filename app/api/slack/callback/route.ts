import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://localhost:3001';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const cookieStore = cookies();
    const userEmail = cookieStore.get('user_email')?.value;

    if (error) {
      console.error('Slack OAuth error:', error);
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      console.error('No code provided');
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=no_code`);
    }

    if (!userEmail) {
      console.error('No user email found in cookies');
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=not_authenticated`);
    }

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !SLACK_REDIRECT_URI) {
      console.error('Missing required environment variables');
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=configuration_error`);
    }

    // Exchange the code for an access token
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code: code,
        redirect_uri: SLACK_REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Failed to get access token:', data.error);
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=${encodeURIComponent(data.error)}`);
    }

    try {
      // Get bot details
      const botDetails = {
        botId: data.bot_user_id,
        botAccessToken: data.access_token,
        botEmail: `botuser-${data.team.id}-${data.bot_user_id}@slack-bots.com`,
        botScopes: data.scope.split(','),
        isEnterpriseInstall: data.is_enterprise_install || false
      };

      // Store workspace data in slack_workspaces collection
      const workspaceDoc = doc(db, 'slack_workspaces', data.team.id);
      const existingWorkspace = await getDoc(workspaceDoc);
      
      await setDoc(workspaceDoc, {
        teamId: data.team.id,
        teamName: data.team.name,
        botUserId: data.bot_user_id,
        botAccessToken: data.access_token,
        botEmail: botDetails.botEmail,
        botScopes: data.scope,
        isEnterpriseInstall: botDetails.isEnterpriseInstall,
        installedBy: userEmail,
        installedAt: existingWorkspace.exists() ? existingWorkspace.data().installedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        connectedUsers: existingWorkspace.exists() 
          ? Array.from(new Set([...existingWorkspace.data().connectedUsers, userEmail]))
          : [userEmail]
      }, { merge: true });

      // Store the integration info in the user's document
      const userDoc = doc(db, 'users', userEmail);
      await setDoc(userDoc, {
        slackIntegration: {
          teamId: data.team.id,
          teamName: data.team.name,
          botUserId: data.bot_user_id,
          botEmail: botDetails.botEmail,
          authedUser: {
            id: data.authed_user.id
          },
          type: 'slack',
          config: {
            channels: []
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      // Redirect back to the integrations page with success message
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?slack_connected=true`);
    } catch (error) {
      console.error('Error storing Slack data:', error);
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=database_error`);
    }
  } catch (error) {
    console.error('Error in Slack callback:', error);
    return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
} 