export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the configured environment variables
    const clientId = process.env.NOTION_CLIENT_ID || '';
    const clientSecret = process.env.NOTION_CLIENT_SECRET ? '[REDACTED]' : '';
    const redirectUri = process.env.NOTION_REDIRECT_URI || '';
    const baseUrl = process.env.NEXTAUTH_URL || 'https://localhost:3001';
    
    // Check if the email parameter is provided
    const email = request.nextUrl.searchParams.get('email');

    // Build the OAuth URL for testing
    const fullRedirectUri = `${baseUrl}/api/notion/callback`;
    
    // Create parameter object for OAuth URL
    const params = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state: email || 'test@example.com'
    };
    
    // Debug data to return
    const debugData = {
      environmentConfig: {
        hasClientId: !!clientId,
        clientIdPrefix: clientId ? `${clientId.substring(0, 5)}...` : null,
        hasClientSecret: !!process.env.NOTION_CLIENT_SECRET,
        configuredRedirectUri: redirectUri,
        baseUrl,
        computedRedirectUri: fullRedirectUri
      },
      authUrlParams: params,
      fullAuthUrl: `https://api.notion.com/v1/oauth/authorize?${new URLSearchParams(params).toString()}`,
      registeredCallbackEndpoint: '/api/notion/callback',
      testCallbackUrl: `${baseUrl}/api/notion/callback?code=test_code&state=${email || 'test@example.com'}`
    };

    return NextResponse.json(debugData);
  } catch (error) {
    console.error('Error in notion-redirect debug endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 