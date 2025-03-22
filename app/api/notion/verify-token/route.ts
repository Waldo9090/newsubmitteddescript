import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function POST(request: Request) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    // Initialize Notion client
    const notion = new Client({
      auth: accessToken,
    });

    // Test the token by making a simple API call
    const user = await notion.users.me({});

    return NextResponse.json({ 
      success: true,
      user: {
        name: user.name,
        type: user.type
      }
    });
  } catch (error: any) {
    console.error('[Notion Verify Token] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Invalid token' },
      { status: 401 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 