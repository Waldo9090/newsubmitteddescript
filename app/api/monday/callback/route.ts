import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');
    
    // Verify state parameter
    const cookieStore = cookies();
    const storedState = cookieStore.get('monday_oauth_state')?.value;
    
    if (state && storedState && state !== storedState) {
      console.error('State mismatch in OAuth callback');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=invalid_state`);
    }
    
    // Handle errors from OAuth provider
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      
      // Handle specific error for app not installed
      if (error === 'access_denied' && errorDescription?.includes('not installed')) {
        return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
      console.error('No code received from Monday.com');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=no_code`);
    }

    // Define Monday.com OAuth parameters
    const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
    const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/monday/callback`;
    
    if (!MONDAY_CLIENT_ID || !MONDAY_CLIENT_SECRET) {
      console.error('Missing Monday.com client credentials');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=missing_credentials`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: MONDAY_CLIENT_ID,
        client_secret: MONDAY_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      
      // Check if error is related to app not being installed
      if (errorText.includes('not installed') || errorText.includes('install the app')) {
        return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token');

    // Get user info from Monday.com API
    const userResponse = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { me { id name email account { id name } } }`,
      }),
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Failed to get user info:', errorText);
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    console.log('Successfully retrieved user info');

    if (!userData.data?.me?.account) {
      console.error('Invalid user account data from Monday.com');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=invalid_account_data`);
    }

    // Get email from cookies, which would have been set during the auth flow
    const userEmailCookie = cookieStore.get('user_email');
    const userEmail = userEmailCookie?.value;

    if (!userEmail) {
      console.error('No user email found in cookies');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=no_user_email`);
    }

    // Store the token in Firestore
    const db = getFirebaseDb();
    await setDoc(doc(db, 'users', userEmail), {
      mondayIntegration: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        accountId: userData.data.me.account.id,
        workspaceId: userData.data.me.account.id,
        workspaceName: userData.data.me.account.name,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        config: {
          items: true,
          boards: true,
          includeMeetingNotes: true,
          includeActionItems: true,
        },
        updatedAt: serverTimestamp(),
      }
    }, { merge: true });
    console.log('Saved Monday.com integration for user:', userEmail);

    // Clear OAuth cookies
    cookieStore.delete('user_email');
    cookieStore.delete('monday_oauth_state');

    // Redirect back to the integrations page
    return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?success=true&provider=monday`);
  } catch (error) {
    console.error('Error in Monday.com callback:', error);
    return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=unknown`);
  }
} 