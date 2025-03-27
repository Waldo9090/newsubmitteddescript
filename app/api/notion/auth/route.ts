export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  console.log('Notion auth endpoint called');
  
  try {
    // Always use the production URL for Vercel deployment
    const baseUrl = 'https://www.aisummarizer-descript.com';
    console.log('Using base URL:', baseUrl);
    
    // Get the user email from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const email = authHeader.replace('Bearer ', '');
    console.log('User email from auth header:', email);
    
    // Check for required environment variables
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('Missing Notion credentials:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      });
      return NextResponse.json({ error: 'Configuration error: Missing Notion API credentials' }, { status: 500 });
    }
    
    // Use the redirect URI that is registered with Notion
    // If NOTION_REDIRECT_URI is set, use that, otherwise construct it from the base URL
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${baseUrl}/api/notion/callback`;
    console.log('Using redirect URI:', redirectUri);
    
    // Build the OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
      state: email // Pass the user email as state for callback verification
    });
    
    const notionUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
    console.log('Generated Notion OAuth URL (hiding client_id):', 
      notionUrl.replace(clientId, '********'));
    
    return NextResponse.json({ url: notionUrl });
  } catch (error) {
    console.error('Error generating Notion auth URL:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 