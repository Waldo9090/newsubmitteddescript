import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${BASE_URL}/api/hubspot/callback`;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorMessage = searchParams.get('error_description');
    const encodedState = searchParams.get('state');

    // Debug log incoming request
    console.log('[HubSpot Callback] Request received:', {
      code: code ? 'present' : 'missing',
      error,
      errorMessage,
      hasState: !!encodedState,
      url: request.url,
      timestamp: new Date().toISOString()
    });

    if (error) {
      console.error('[HubSpot Callback] OAuth error:', { error, errorMessage });
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/integrations?error=hubspot_auth_failed&message=${encodeURIComponent(errorMessage || '')}`
      );
    }

    if (!code || !encodedState) {
      console.error('[HubSpot Callback] Missing parameters:', { code: !!code, state: !!encodedState });
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/integrations?error=missing_params`
      );
    }

    // Decode and validate state
    let stateData;
    try {
      // Extract only the base64url-encoded state (remove any appended data)
      const encodedState = searchParams.get('state')?.split(',')[0] || '';
      
      // Restore base64 padding and decode
      const base64State = encodedState
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const padding = base64State.length % 4;
      const paddedState = padding ? base64State + '='.repeat(4 - padding) : base64State;
      
      const decodedState = Buffer.from(paddedState, 'base64').toString();
      stateData = JSON.parse(decodedState);
      
      if (!stateData.email || !stateData.nonce || !stateData.timestamp) {
        throw new Error('Invalid state data structure');
      }

      // Check if state is not too old (e.g., 1 hour)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 3600000) { // 1 hour in milliseconds
        throw new Error('State token expired');
      }
    } catch (stateError) {
      console.error('[HubSpot Callback] State validation failed:', stateError);
      return NextResponse.redirect(
        `${BASE_URL}/dashboard/integrations?error=invalid_state`
      );
    }

    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
      throw new Error('HubSpot credentials not configured');
    }

    // Exchange code for access token according to HubSpot's documentation
    console.log('[HubSpot Callback] Exchanging code for token...');
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[HubSpot Callback] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[HubSpot Callback] Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope
    });

    // Get HubSpot account details
    console.log('[HubSpot Callback] Fetching account details...');
    const accountResponse = await fetch('https://api.hubapi.com/integrations/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('[HubSpot Callback] Account details fetch failed:', {
        status: accountResponse.status,
        statusText: accountResponse.statusText,
        error: errorText
      });
      throw new Error('Failed to fetch HubSpot account details');
    }

    const accountData = await accountResponse.json();
    console.log('[HubSpot Callback] Account details:', {
      portalId: accountData.portalId,
      accountType: accountData.accountType,
      timezone: accountData.timezone
    });

    // First, check if user document exists and get any existing data
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', stateData.email);
    const existingDoc = await getDoc(userDocRef);
    const existingData = existingDoc.exists() ? existingDoc.data() : {};

    // Store only necessary HubSpot integration data
    const hubspotIntegration = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
      portalId: accountData.portalId?.toString() || '',
      accountType: accountData.accountType || 'UNKNOWN',
      timezone: accountData.timezone || 'UTC',
      updatedAt: new Date().toISOString()
    };

    // Merge with existing data
    const mergedData = {
      ...existingData,
      email: stateData.email,
      hubspotIntegration,
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore
    try {
      await setDoc(userDocRef, mergedData, { merge: true });
      console.log('[HubSpot Callback] Successfully saved to Firestore');
    } catch (firestoreError) {
      console.error('[HubSpot Callback] Firestore save error:', firestoreError);
      throw firestoreError;
    }

    return NextResponse.redirect(
      `${BASE_URL}/dashboard/integrations?success=true`
    );
  } catch (error) {
    console.error('[HubSpot Callback] Fatal error:', error);
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/integrations?error=server_error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    );
  }
} 