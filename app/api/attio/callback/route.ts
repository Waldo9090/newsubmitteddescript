import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { cookies } from 'next/headers';

// Attio OAuth configuration
const ATTIO_CLIENT_ID = process.env.ATTIO_CLIENT_ID || 'b98e1808-8a21-4ac6-94af-e2fb4dfc79ce';
const ATTIO_CLIENT_SECRET = process.env.ATTIO_CLIENT_SECRET || 'cd8faae08407dc9c5e0256583f8933f994149f3530f75ac17953213432696607';
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL 
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/attio/callback`
  : 'https://www.aisummarizer-descript.com/api/attio/callback';
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.aisummarizer-descript.com';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');
    
    // Verify state parameter to protect against CSRF
    const cookieStore = cookies();
    const storedState = cookieStore.get('attio_oauth_state')?.value;
    
    if (state && storedState && state !== storedState) {
      console.error('State mismatch in OAuth callback - possible CSRF attack');
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=invalid_state`);
    }
    
    // Handle errors from OAuth provider
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=${error}&message=${errorDescription || 'Unknown error'}`);
    }

    if (!code) {
      console.error('No authorization code received from Attio');
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=no_code`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://app.attio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        client_id: ATTIO_CLIENT_ID,
        client_secret: ATTIO_CLIENT_SECRET,
        grant_type: 'authorization_code',
        authorization_code: code,
        redirect_uri: REDIRECT_URI
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for Attio access token');

    // Get the user's workspace information
    const workspaceResponse = await fetch('https://app.attio.com/api/v2/workspace', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!workspaceResponse.ok) {
      const errorText = await workspaceResponse.text();
      console.error('Failed to get workspace info:', errorText);
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=workspace_info_failed`);
    }

    const workspaceData = await workspaceResponse.json();
    console.log('Successfully retrieved workspace info');

    // Get email from cookies, which was set during the auth flow
    const userEmailCookie = cookieStore.get('attio_user_email');
    const userEmail = userEmailCookie?.value;

    if (!userEmail) {
      console.error('No user email found in cookies');
      return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=no_user_email`);
    }

    // Store the token in Firestore
    const db = getFirebaseDb();
    
    // Update the user's integrations/attio document
    await setDoc(doc(db, 'users', userEmail, 'integrations', 'attio'), {
      connected: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      workspace: {
        id: workspaceData.id,
        name: workspaceData.name,
        logo: workspaceData.logo || null
      },
      scopes: tokenData.scope.split(' '),
      connectedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('Saved Attio integration for user:', userEmail);

    // Clear OAuth cookies
    cookieStore.delete('attio_user_email');
    cookieStore.delete('attio_oauth_state');

    // Redirect back to the integrations page
    return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?success=true&provider=attio`);
  } catch (error) {
    console.error('Error in Attio callback:', error);
    return Response.redirect(`${NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=unknown`);
  }
} 