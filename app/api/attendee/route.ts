import { NextResponse } from 'next/server';

const API_BASE_URL = 'https://app.attendee.dev/api/v1';
const API_KEY = process.env.ATTENDEE_API_KEY;

if (!API_KEY) {
  throw new Error('Missing Attendee API key in environment variables');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpoint, method = 'POST', data } = body;

    console.log('Proxying request to Attendee API:', {
      url: `${API_BASE_URL}${endpoint}`,
      method,
      data
    });

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Token ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    const responseData = await response.json();
    console.log('Attendee API response:', responseData);

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch (error) {
    console.error('Proxy request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to proxy request' },
      { status: 500 }
    );
  }
} 