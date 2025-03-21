import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function POST(request: Request) {
  try {
    const { pageId, content, title, accessToken } = await request.json();

    if (!pageId || !content || !title || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Initialize Notion client with the access token
    const notion = new Client({
      auth: accessToken
    });

    console.log('Creating Notion page:', {
      parentPageId: pageId,
      title: title,
      contentLength: content.length
    });

    // Create a new page in Notion
    const response = await notion.pages.create({
      parent: {
        page_id: pageId
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title
              }
            }
          ]
        }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: content
                }
              }
            ]
          }
        }
      ]
    });

    console.log('Successfully created Notion page:', response.id);

    return NextResponse.json({ success: true, pageId: response.id });
  } catch (error) {
    console.error('Error creating Notion page:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create Notion page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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