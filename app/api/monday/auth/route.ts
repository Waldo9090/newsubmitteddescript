import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Constants
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || '';
const ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENV === 'production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
const CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || 'https://www.aisummarizer-descript.com';

// Use the custom domain in production, otherwise use the base URL
const REDIRECT_BASE = IS_PRODUCTION ? CUSTOM_DOMAIN : BASE_URL;
const REDIRECT_URI = `${REDIRECT_BASE}/api/monday/callback`;

console.log('Monday Auth Environment:', {
  environment: ENV,
  isProduction: IS_PRODUCTION,
  baseUrl: BASE_URL,
  customDomain: CUSTOM_DOMAIN,
  redirectUri: REDIRECT_URI,
  hasClientId: !!MONDAY_CLIENT_ID
});

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = authHeader.split('Bearer ')[1];
    if (!userEmail) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Store the user email in a cookie for later retrieval in the callback
    const cookieStore = cookies();
    
    // Set cookie for user email
    cookieStore.set('user_email', encodeURIComponent(userEmail), {
      httpOnly: true,
      // Only use secure in production
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes expiration, enough for OAuth flow
    });
    
    // Generate a state parameter for security
    const state = randomBytes(16).toString('hex');
    
    // Set cookie for state
    cookieStore.set('monday_oauth_state', state, {
      httpOnly: true,
      // Only use secure in production
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes expiration
    });

    // Log the cookies being set for debugging
    console.log('Setting cookies for OAuth flow:');
    console.log('- user_email:', userEmail);
    console.log('- monday_oauth_state:', state);

    // Standard OAuth URL for authorization
    const authUrl = `https://auth.monday.com/oauth2/authorize?` + new URLSearchParams({
      client_id: MONDAY_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: state,
    }).toString();

    console.log('Generated Monday auth URL:', authUrl);
    console.log('Using redirect URI:', REDIRECT_URI);

    return NextResponse.json({ 
      url: authUrl,
      message: "Ready to connect to Monday.com."
    });
  } catch (error: any) {
    console.error('Error in Monday auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 