import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Attio OAuth configuration
const ATTIO_CLIENT_ID = process.env.ATTIO_CLIENT_ID || 'b98e1808-8a21-4ac6-94af-e2fb4dfc79ce';
const REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL 
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/attio/callback`
  : 'https://www.aisummarizer-descript.com/api/attio/callback';

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
    cookieStore.set('attio_user_email', userEmail, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes expiration, enough for OAuth flow
    });
    
    // Generate a state parameter for security (CSRF protection)
    const state = randomBytes(16).toString('hex');
    
    // Store the state in a cookie for verification in the callback
    cookieStore.set('attio_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes expiration
    });

    // Construct the authorization URL for Attio
    const authUrl = `https://app.attio.com/authorize?` + new URLSearchParams({
      client_id: ATTIO_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      state: state,
    }).toString();

    console.log('Generated Attio authorization URL:', authUrl);

    return NextResponse.json({ 
      url: authUrl,
      message: "Ready to connect to Attio."
    });
  } catch (error: any) {
    console.error('Error in Attio auth route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 