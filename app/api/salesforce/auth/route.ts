import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://localhost:3001';
const REDIRECT_URI = `${BASE_URL}/api/salesforce/callback`;

// Define required scopes according to Salesforce's documentation
const REQUIRED_SCOPES = [
  'api',
  'refresh_token',
  'chatter_api',
  'full',
  'wave_api',
  'visualforce',
  'web',
  'content'
].join(' ');

export async function GET(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    console.log('[Salesforce Auth] Initializing auth request:', {
      hasClientId: !!SALESFORCE_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      baseUrl: BASE_URL,
      hasUserEmail: !!userEmail
    });

    if (!SALESFORCE_CLIENT_ID) {
      throw new Error('SALESFORCE_CLIENT_ID is not configured');
    }

    if (!userEmail) {
      throw new Error('No user email provided in Authorization header');
    }

    // Generate a unique state value for security
    const stateNonce = crypto.randomBytes(16).toString('hex');
    const state = {
      nonce: stateNonce,
      email: userEmail,
      timestamp: Date.now()
    };
    
    // Encode state as base64url to ensure URL safety
    const encodedState = Buffer.from(JSON.stringify(state))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Create authorization URL according to Salesforce's documentation
    const authUrl = new URL('https://login.salesforce.com/services/oauth2/authorize');
    authUrl.searchParams.append('client_id', SALESFORCE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', REQUIRED_SCOPES);
    authUrl.searchParams.append('state', encodedState);
    authUrl.searchParams.append('prompt', 'consent');

    console.log('[Salesforce Auth] Generated auth URL:', {
      url: authUrl.toString(),
      params: {
        client_id: SALESFORCE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: REQUIRED_SCOPES,
        state: 'REDACTED',
        prompt: 'consent'
      }
    });

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error: any) {
    console.error('[Salesforce Auth] Error generating auth URL:', {
      error,
      stack: error?.stack,
      message: error?.message
    });
    return NextResponse.json(
      { error: error?.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
} 