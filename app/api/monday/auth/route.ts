import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Monday.com OAuth configuration
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || '9ae3e86e3d7b4b28d319ad66477fdb23';
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/monday/callback`;

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
    cookieStore.set('user_email', userEmail, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes expiration, enough for OAuth flow
    });
    
    // Generate a state parameter for security
    const state = randomBytes(16).toString('hex');
    
    // Store the state in a cookie for verification in the callback
    cookieStore.set('monday_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes expiration
    });

    // Standard OAuth URL for authorization
    const authUrl = `https://auth.monday.com/oauth2/authorize?` + new URLSearchParams({
      client_id: MONDAY_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: state,
    }).toString();

    console.log('Generated Monday auth URL:', authUrl);

    return NextResponse.json({ 
      url: authUrl,
      message: "Ready to connect to Monday.com."
    });
  } catch (error: any) {
    console.error('Error in Monday auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 