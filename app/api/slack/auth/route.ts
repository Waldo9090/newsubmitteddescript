import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID?.trim();
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI?.trim();

// Define required scopes - matching exactly what's in your Slack app settings
const SLACK_SCOPES = [
  'channels:read',
  'chat:write',
  'chat:write.customize',
  'chat:write.public',
  'groups:read',
  'team:read',
  'users:read',
  'users:read.email'
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
      return new NextResponse(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401 }
      );
    }

    // Extract the email from the Authorization header
    const userEmail = authHeader.split(' ')[1];
    if (!userEmail) {
      return new NextResponse(
        JSON.stringify({ error: 'No user email provided' }),
        { status: 401 }
      );
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

    // Construct Slack OAuth URL with properly formatted client_id
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${SLACK_SCOPES}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;
    
    console.log('Generated Slack auth URL:', slackAuthUrl);
    
    // Get the origin of the request
    const origin = headersList.get('origin') || '';

    return new NextResponse(
      JSON.stringify({ url: slackAuthUrl }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error) {
    console.error('Error in Slack auth route:', error);
    const headersList = headers();
    const origin = headersList.get('origin') || '';

    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to generate auth URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
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