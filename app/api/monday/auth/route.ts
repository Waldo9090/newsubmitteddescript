import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

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
    cookieStore.set('user_email', encodeURIComponent(userEmail), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes expiration, enough for OAuth flow
    });

    // Define Monday.com OAuth parameters
    const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
    if (!MONDAY_CLIENT_ID) {
      console.error('Missing MONDAY_CLIENT_ID environment variable');
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
    }
    
    // Use the correct base URL based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const BASE_URL = isDevelopment ? 'https://localhost:3001' : process.env.NEXT_PUBLIC_BASE_URL;
    const REDIRECT_URI = `${BASE_URL}/api/monday/callback`;
    
    console.log('Using Monday.com redirect URI:', REDIRECT_URI);
    
    // Generate a state parameter for security
    const state = randomBytes(16).toString('hex');
    
    // Store the state in a cookie for verification in the callback
    cookieStore.set('monday_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5, // 5 minutes expiration
    });

    // Construct the Monday.com OAuth URL
    const authUrl = `https://auth.monday.com/oauth2/authorize?` + new URLSearchParams({
      client_id: MONDAY_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: state,
    }).toString();

    console.log('Generated Monday auth URL:', authUrl);

    return NextResponse.json({ 
      url: authUrl, 
      state,
      message: "You'll be redirected to Monday.com. If prompted, please install the Descript app before authorizing."
    });
  } catch (error: any) {
    console.error('Error in Monday auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 