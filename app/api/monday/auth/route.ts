import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Monday.com OAuth configuration
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || '9ae3e86e3d7b4b28d319ad66477fdb23';
// Always use the production domain for OAuth flow since Monday.com app is registered with this domain
const NEXT_PUBLIC_BASE_URL = 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/monday/callback`;
// Detect environment for cookie settings only
const isDevelopment = process.env.NODE_ENV === 'development';

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
    
    // Set cookie with more compatible settings for development
    cookieStore.set('user_email', userEmail, {
      httpOnly: true,
      // Only use secure in production
      secure: !isDevelopment,
      sameSite: isDevelopment ? 'lax' : 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes expiration, enough for OAuth flow
    });
    
    // Generate a state parameter for security
    const state = randomBytes(16).toString('hex');
    
    // Store the state in a cookie for verification in the callback
    cookieStore.set('monday_oauth_state', state, {
      httpOnly: true,
      // Only use secure in production
      secure: !isDevelopment,
      sameSite: isDevelopment ? 'lax' : 'lax',
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