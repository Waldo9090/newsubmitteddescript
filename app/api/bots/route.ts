import { NextResponse } from 'next/server';

const ATTENDEE_API_KEY = process.env.ATTENDEE_API_KEY;
const BASE_URL = 'https://app.attendee.dev/api/v1';

if (!ATTENDEE_API_KEY) {
  throw new Error('ATTENDEE_API_KEY environment variable is not set');
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Token ${ATTENDEE_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${error}`);
  }

  return response.json();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { meeting_url, bot_name } = body;

    if (!meeting_url || !bot_name) {
      return NextResponse.json(
        { error: 'meeting_url and bot_name are required' },
        { status: 400 }
      );
    }

    const data = await makeRequest('/bots', {
      method: 'POST',
      body: JSON.stringify({
        meeting_url,
        bot_name,
        transcription_settings: {
          deepgram: { language: 'en' }
        },
        recording_settings: {
          format: 'mp4'
        }
      })
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error creating bot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bot' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    const data = await makeRequest(`/bots/${botId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error getting bot status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get bot status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('botId');
    
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    const data = await makeRequest(`/bots/${botId}/leave`, {
      method: 'POST'
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error leaving bot:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to leave bot' },
      { status: 500 }
    );
  }
}