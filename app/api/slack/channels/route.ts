import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  try {
    // Get the access token from Authorization header
    const headersList = headers();
    const authHeader = headersList.get('Authorization');
    if (!authHeader) {
      return new NextResponse(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401 }
      );
    }

    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      return new NextResponse(
        JSON.stringify({ error: 'No access token provided' }),
        { status: 401 }
      );
    }

    // Fetch channels from Slack API
    const response = await fetch('https://slack.com/api/conversations.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch channels from Slack');
    }

    // Filter out archived channels and format the response
    const channels = data.channels
      .filter((channel: any) => !channel.is_archived)
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_member: channel.is_member
      }));

    return new NextResponse(
      JSON.stringify({ channels }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Failed to fetch channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 