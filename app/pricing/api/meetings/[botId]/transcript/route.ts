import { NextRequest, NextResponse } from 'next/server';

const ATTENDEE_API_KEY = process.env.ATTENDEE_API_KEY;
const ATTENDEE_API_URL = 'https://app.attendee.dev/api/v1';

if (!ATTENDEE_API_KEY) {
  throw new Error('ATTENDEE_API_KEY environment variable is not set');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const { botId } = await params;

    const url = `${ATTENDEE_API_URL}/bots/${botId}/transcript`;
    const headers = {
      'Authorization': `Token ${ATTENDEE_API_KEY}`,
      'Content-Type': 'application/json',
    };

    console.log('Making Attendee API request:', {
      url,
      method: 'GET',
      headers: {
        ...headers,
        'Authorization': 'Token [REDACTED]'
      }
    });
    
    const response = await fetch(url, { headers });

    console.log('Attendee API Response:', {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      ok: response.ok,
      type: response.type
    });

    let responseText;
    try {
      responseText = await response.text();
      const transcript = JSON.parse(responseText);
      
      console.log('Attendee API Response Data:', {
        isArray: Array.isArray(transcript),
        length: Array.isArray(transcript) ? transcript.length : 'not an array',
        data: JSON.stringify(transcript, null, 2)
      });

      if (!response.ok) {
        console.error('Attendee API Error Response:', responseText);
        throw new Error(`Failed to get transcript: ${responseText}`);
      }

      return NextResponse.json(transcript);
    } catch (error: any) {
      console.error('Error parsing response:', {
        responseText,
        error: error.message || error
      });
      throw new Error(`Failed to parse transcript response: ${error.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.error('Error getting transcript:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get transcript' },
      { status: 500 }
    );
  }
}