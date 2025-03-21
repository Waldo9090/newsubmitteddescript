import { NextResponse } from 'next/server';

const BASE_URL = 'https://app.attendee.dev/api/v1';
const API_KEY = process.env.ATTENDEE_API_KEY;

if (!API_KEY) {
  throw new Error('ATTENDEE_API_KEY environment variable is not set');
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Token ${API_KEY}`,
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    // Check for authentication error in XML response
    if (text.includes('<Code>AuthenticationRequired</Code>')) {
      throw new Error('Authentication failed - please check your API key');
    }
    throw new Error(`Expected JSON response but got ${contentType}. Response: ${text.substring(0, 100)}...`);
  }

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'API request failed');
  }

  return data;
}

export async function GET(
  request: Request,
  { params }: { params: { botId: string } }
) {
  try {
    const { botId } = await params;
    if (!botId) {
      return NextResponse.json(
        { error: 'Bot ID is required' },
        { status: 400 }
      );
    }

    const recording = await makeRequest(`/bots/${botId}/recording`);
    return NextResponse.json(recording);
  } catch (error: any) {
    console.error('Error getting recording:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get recording' },
      { status: 500 }
    );
  }
}