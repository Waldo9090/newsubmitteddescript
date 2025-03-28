import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

// Attio OAuth configuration
const ATTIO_CLIENT_ID = process.env.ATTIO_CLIENT_ID || '';
// Always use the production domain for OAuth flow since Attio app is registered with this domain
const NEXT_PUBLIC_BASE_URL = 'https://www.aisummarizer-descript.com';
const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/attio/callback`;
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
    cookieStore.set('attio_oauth_state', state, {
      httpOnly: true,
      // Only use secure in production
      secure: !isDevelopment,
      sameSite: isDevelopment ? 'lax' : 'lax',
      path: '/',
      maxAge: 60 * 15, // 15 minutes expiration
    });

    // Log the cookies being set for debugging
    console.log('Setting cookies for Attio OAuth flow:');
    console.log('- user_email:', userEmail);
    console.log('- attio_oauth_state:', state);

    // Construct the Authorization URL for Attio as per their docs
    // https://app.attio.com/authorize
    const authUrl = `https://app.attio.com/authorize?` + new URLSearchParams({
      client_id: ATTIO_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code', // As specified in Attio docs, this should always be 'code'
      state: state
    }).toString();

    console.log('Generated Attio auth URL:', authUrl);
    console.log('Using redirect URI:', REDIRECT_URI);

    return NextResponse.json({ 
      url: authUrl,
      message: "Ready to connect to Attio."
    });
  } catch (error: any) {
    console.error('Error in Attio auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 