import { NextResponse } from 'next/server';
import crypto from 'crypto';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${BASE_URL}/api/hubspot/callback`;

// Define required scopes according to HubSpot's documentation
const REQUIRED_SCOPES = [
  'content',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'oauth',
  'scheduler.meetings.meeting-link.read',
  'timeline'
].join(' ');

export async function GET(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    console.log('[HubSpot Auth] Initializing auth request:', {
      hasClientId: !!HUBSPOT_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      baseUrl: BASE_URL,
      hasUserEmail: !!userEmail
    });

    if (!HUBSPOT_CLIENT_ID) {
      throw new Error('HUBSPOT_CLIENT_ID is not configured');
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

    // Create authorization URL according to HubSpot's documentation
    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.append('client_id', HUBSPOT_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', REQUIRED_SCOPES);
    authUrl.searchParams.append('state', encodedState);

    console.log('[HubSpot Auth] Generated auth URL:', {
      url: authUrl.toString(),
      params: {
        client_id: HUBSPOT_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: REQUIRED_SCOPES,
        state: 'REDACTED'
      }
    });

    return NextResponse.json({ url: authUrl.toString() });
  } catch (error: any) {
    console.error('[HubSpot Auth] Error generating auth URL:', {
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