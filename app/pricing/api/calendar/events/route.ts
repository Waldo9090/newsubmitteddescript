import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('email');

  if (!userEmail) {
    return NextResponse.json({ error: 'Missing user email' }, { status: 400 });
  }

  try {
    // Get user's Google Calendar tokens from Firestore
    const userDoc = await getDoc(doc(getFirebaseDb(), 'users', userEmail));
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const googleCalendar = userData.googleCalendar;

    if (!googleCalendar) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = googleCalendar.accessToken;
    if (Date.now() >= googleCalendar.expiresAt) {
      accessToken = await refreshAccessToken(googleCalendar.refreshToken);
    }

    // Fetch calendar events
    const now = new Date();
    const oneMonthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    console.log('Fetching calendar events with token:', accessToken.substring(0, 10) + '...');
    
    const eventsResponse = await fetch(
      `${CALENDAR_EVENTS_URL}?timeMin=${now.toISOString()}&timeMax=${oneMonthFromNow.toISOString()}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventsResponse.ok) {
      const errorData = await eventsResponse.text();
      console.error('Calendar API error:', {
        status: eventsResponse.status,
        statusText: eventsResponse.statusText,
        error: errorData
      });
      throw new Error(`Failed to fetch calendar events: ${eventsResponse.status} ${eventsResponse.statusText}`);
    }

    const events = await eventsResponse.json();
    console.log('Raw calendar events:', events);

    // Filter events to only include those with meeting links
    const meetingEvents = events.items.filter((event: any) => {
      return (
        event.hangoutLink || // Google Meet
        (event.description && (
          event.description.includes('zoom.us') || // Zoom
          event.description.includes('teams.microsoft.com') // Microsoft Teams
        ))
      );
    });

    return NextResponse.json({
      events: meetingEvents.map((event: any) => ({
        id: event.id,
        title: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        meetingLink: event.hangoutLink || 
          (event.description?.match(/(https:\/\/[^\s<]+(?=(?:<|$)))/)?.[0] || null),
        description: event.description,
      }))
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}