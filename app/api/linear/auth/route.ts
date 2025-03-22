import { NextResponse } from 'next/server';
import crypto from 'crypto';

const LINEAR_CLIENT_ID = process.env.LINEAR_CLIENT_ID;
const BASE_URL = process.env.NEXTAUTH_URL || 'https://localhost:3003';
const REDIRECT_URI = `${BASE_URL}/api/linear/callback`;

// Define required scopes according to Linear's documentation
const REQUIRED_SCOPES = [
  'read',
  'write',
  'issues:create'
].join(',');

export async function GET(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    console.log('[Linear Auth] Initializing auth request:', {
      hasClientId: !!LINEAR_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      baseUrl: BASE_URL,
      hasUserEmail: !!userEmail,
      scopes: REQUIRED_SCOPES
    });

    if (!LINEAR_CLIENT_ID) {
      throw new Error('LINEAR_CLIENT_ID is not configured');
    }

    if (!userEmail) {
      throw new Error('No user email provided in Authorization header');
    }

    // Generate a secure random state for CSRF protection
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

    // Create authorization URL according to Linear's documentation
    const linearUrl = new URL('https://linear.app/oauth/authorize');
    linearUrl.searchParams.append('client_id', LINEAR_CLIENT_ID);
    linearUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    linearUrl.searchParams.append('response_type', 'code');
    linearUrl.searchParams.append('scope', REQUIRED_SCOPES);
    linearUrl.searchParams.append('state', encodedState);
    linearUrl.searchParams.append('actor', 'user'); // Resources created as the user who authorized
    linearUrl.searchParams.append('prompt', 'consent'); // Always show consent screen

    console.log('[Linear Auth] Generated auth URL:', {
      url: linearUrl.toString(),
      params: {
        client_id: LINEAR_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: REQUIRED_SCOPES,
        state: 'REDACTED',
        actor: 'user',
        prompt: 'consent'
      }
    });

    return NextResponse.json({ url: linearUrl.toString() });
  } catch (error: any) {
    console.error('[Linear Auth] Error generating auth URL:', {
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