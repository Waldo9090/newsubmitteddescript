import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${BASE_URL}/api/salesforce/callback`;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[Salesforce Callback] Received callback:', {
      hasCode: !!code,
      hasState: !!state,
      error
    });

    if (error) {
      throw new Error(`Authorization error: ${error}`);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    // Decode and validate state
    const decodedState = JSON.parse(
      Buffer.from(state, 'base64url').toString()
    );

    if (!decodedState.email || !decodedState.nonce || !decodedState.timestamp) {
      throw new Error('Invalid state parameter');
    }

    // Check if state is not too old (10 minutes)
    const stateAge = Date.now() - decodedState.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      throw new Error('State parameter has expired');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: SALESFORCE_CLIENT_ID!,
        client_secret: SALESFORCE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        code
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[Salesforce Callback] Received token data:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      instanceUrl: tokenData.instance_url,
      tokenType: tokenData.token_type
    });

    // Test the token with a simple API call
    const testResponse = await fetch(`${tokenData.instance_url}/services/data/v59.0/sobjects/User/${tokenData.id.split('/').pop()}`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!testResponse.ok) {
      throw new Error('Failed to validate access token with test API call');
    }

    const userData = await testResponse.json();
    console.log('[Salesforce Callback] Validated token with test API call:', {
      userId: userData.Id,
      username: userData.Username
    });

    // Store token in Firestore
    const db = getFirebaseDb();
    const userDoc = doc(db, 'users', decodedState.email);
    const userSnapshot = await getDoc(userDoc);

    if (!userSnapshot.exists()) {
      throw new Error('User document not found');
    }

    await setDoc(userDoc, {
      ...userSnapshot.data(),
      salesforce: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        instanceUrl: tokenData.instance_url,
        userId: userData.Id,
        username: userData.Username,
        connectedAt: new Date().toISOString()
      }
    }, { merge: true });

    console.log('[Salesforce Callback] Stored token data in Firestore');

    // Redirect back to dashboard with success message
    const redirectUrl = new URL('/dashboard/settings', BASE_URL);
    redirectUrl.searchParams.append('salesforceConnected', 'true');
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('[Salesforce Callback] Error handling callback:', {
      error,
      stack: error?.stack,
      message: error?.message
    });

    // Redirect back to dashboard with error message
    const redirectUrl = new URL('/dashboard/settings', BASE_URL);
    redirectUrl.searchParams.append('salesforceError', encodeURIComponent(error?.message || 'Failed to connect to Salesforce'));
    return NextResponse.redirect(redirectUrl.toString());
  }
} 