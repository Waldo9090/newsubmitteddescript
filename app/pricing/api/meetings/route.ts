import { NextResponse } from 'next/server';
import { collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';

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

export async function POST(request: Request) {
  try {
    const { meetingUrl } = await request.json();
    
    // Create bot through Attendee API
    const bot = await makeRequest('/bots', {
      method: 'POST',
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'Descript Bot',
        recording_settings: { format: 'mp4' },
        transcription_settings: { deepgram: { language: 'en' } }
      })
    });

    // Save meeting to Firestore
    const meetingRef = collection(getFirebaseDb(), 'scheduledMeetings');
    await addDoc(meetingRef, {
      botId: bot.id,
      meetingUrl,
      status: 'created',
      createdAt: new Date(),
      botCreated: true
    });

    return NextResponse.json(bot);
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create meeting' },
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

    const status = await makeRequest(`/bots/${botId}`);
    return NextResponse.json(status);
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

    const result = await makeRequest(`/bots/${botId}/leave`, {
      method: 'POST'
    });

    // Update meeting status in Firestore
    const meetingsRef = collection(getFirebaseDb(), 'scheduledMeetings');
    const q = query(meetingsRef, where('botId', '==', botId));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      await updateDoc(doc.ref, {
        status: 'ended',
        endedAt: new Date()
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error leaving meeting:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to leave meeting' },
      { status: 500 }
    );
  }
}