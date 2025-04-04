import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function POST(request: Request) {
  try {
    const { accessToken, pageId, title, blocks } = await request.json();

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token provided' }, { status: 401 });
    }

    if (!pageId) {
      return NextResponse.json({ error: 'No page ID provided' }, { status: 400 });
    }

    // Initialize Notion client
    const notion = new Client({
      auth: accessToken,
    });

    // Create the page in Notion
    const response = await notion.pages.create({
      parent: {
        page_id: pageId,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: blocks,
    });

    return NextResponse.json({ success: true, pageId: response.id });
  } catch (error: any) {
    console.error('[Notion Create Page] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create Notion page' },
      { status: 500 }
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