import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID?.trim();
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI?.trim();

// Define scopes matching exactly what's configured in Slack app settings
const SLACK_SCOPES = [
  // Bot Token Scopes
  'channels:read',      // View basic information about public channels
  'chat:write',        // Send messages as bot
  'chat:write.public', // Send messages to channels bot isn't in
  'groups:read',       // View private channels
  'reactions:read',    // View emoji reactions
  'team:read',         // View workspace info
  'users:read',        // View people
  'users:read.email',  // View email addresses
].join(',');

// User Token Scopes - these need to be requested separately
const USER_SCOPES = [
  'identity.basic',    // View user identity
  'identity.email',    // View user email
].join(',');

export async function GET(request: Request) {
  try {
    if (!SLACK_CLIENT_ID || !SLACK_REDIRECT_URI) {
      console.error('Missing required environment variables:', { 
        clientId: !!SLACK_CLIENT_ID, 
        redirectUri: !!SLACK_REDIRECT_URI 
      });
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
    }

    // Get the user's email from the Authorization header
    const headersList = headers();
    const authHeader = headersList.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    // Extract the email from the Authorization header
    const userEmail = authHeader.split(' ')[1];
    if (!userEmail) {
      return NextResponse.json({ error: 'No user email provided' }, { status: 401 });
    }

    // Set the user email cookie with secure settings
    const cookieStore = cookies();
    cookieStore.set('user_email', userEmail, {
      path: '/',
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      httpOnly: true
    });

    // Construct Slack OAuth URL with exact matching scopes
    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.append('client_id', SLACK_CLIENT_ID);
    slackAuthUrl.searchParams.append('scope', SLACK_SCOPES);
    slackAuthUrl.searchParams.append('redirect_uri', SLACK_REDIRECT_URI);
    slackAuthUrl.searchParams.append('user_scope', USER_SCOPES);
    
    // Log the URL for debugging
    console.log('Generated Slack auth URL:', {
      url: slackAuthUrl.toString(),
      scopes: SLACK_SCOPES,
      userScopes: USER_SCOPES
    });
    
    return NextResponse.json({ url: slackAuthUrl.toString() });
  } catch (error) {
    console.error('Error generating Slack auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate Slack authorization URL' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  const headersList = headers();
  const origin = headersList.get('origin') || '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 