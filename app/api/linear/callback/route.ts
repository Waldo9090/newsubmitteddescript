export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID;
const LINEAR_CLIENT_SECRET = process.env.LINEAR_CLIENT_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://localhost:3003';
const REDIRECT_URI = `${BASE_URL}/api/linear/callback`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    console.log('[Linear Callback] Received callback:', {
      hasCode: !!code,
      hasState: !!state,
      url: url.toString()
    });

    if (!code) {
      throw new Error('No authorization code received');
    }

    if (!state) {
      throw new Error('No state parameter received');
    }

    if (!LINEAR_CLIENT_ID || !LINEAR_CLIENT_SECRET) {
      throw new Error('Linear client credentials not configured');
    }

    // Decode and validate state
    let decodedState;
    try {
      const stateJson = Buffer.from(state, 'base64url').toString();
      decodedState = JSON.parse(stateJson);

      // Validate state timestamp (e.g., expires after 1 hour)
      const stateAge = Date.now() - decodedState.timestamp;
      if (stateAge > 3600000) { // 1 hour
        throw new Error('State token expired');
      }
    } catch (error) {
      console.error('[Linear Callback] Invalid state token:', error);
      throw new Error('Invalid state token');
    }

    // Exchange code for access token
    console.log('[Linear Callback] Exchanging code for token...');
    
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        redirect_uri: REDIRECT_URI,
        client_id: LINEAR_CLIENT_ID,
        client_secret: LINEAR_CLIENT_SECRET,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[Linear Callback] Token exchange failed:', {
        status: tokenResponse.status,
        error: errorData
      });
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    console.log('[Linear Callback] Received token response:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    });

    // Verify the token by making a test API call
    const verifyResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenData.access_token}`
      },
      body: JSON.stringify({
        query: '{ viewer { id name } }'
      })
    });

    if (!verifyResponse.ok) {
      throw new Error('Failed to verify access token');
    }

    const userData = await verifyResponse.json();
    console.log('[Linear Callback] Verified token with user data:', {
      userId: userData.data?.viewer?.id,
      userName: userData.data?.viewer?.name
    });

    // Store the token in Firestore
    const db = getFirebaseDb();
    await setDoc(doc(db, 'users', decodedState.email), {
      linearIntegration: {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        expiresIn: tokenData.expires_in,
        connectedAt: Date.now(),
        userId: userData.data?.viewer?.id,
        userName: userData.data?.viewer?.name
      }
    }, { merge: true });

    console.log('[Linear Callback] Saved token to Firestore');

    // Redirect back to the integrations page
    return NextResponse.redirect(`${BASE_URL}/dashboard/integrations`);
  } catch (error: any) {
    console.error('[Linear Callback] Error handling callback:', {
      error,
      stack: error?.stack,
      message: error?.message
    });
    
    // Redirect to error page or integrations page with error param
    const errorUrl = new URL(`${BASE_URL}/dashboard/integrations`);
    errorUrl.searchParams.append('error', 'linear_auth_failed');
    return NextResponse.redirect(errorUrl.toString());
  }
} 