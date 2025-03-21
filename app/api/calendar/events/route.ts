import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXTAUTH_URL}/api/calendar/callback`
);

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('calendar_access_token');
    const refreshToken = cookieStore.get('calendar_refresh_token');

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    oauth2Client.setCredentials({
      access_token: accessToken.value,
      refresh_token: refreshToken?.value,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.data.items?.filter(event => {
      // Check for Google Meet link
      if (event.hangoutLink) return true;
      
      // Check for conference data (Zoom, Teams, etc.)
      if (event.conferenceData?.entryPoints?.some(ep => ep.entryPointType === 'video')) return true;
      
      // Check description and location for common video meeting URLs
      const description = (event.description || '').toLowerCase();
      const location = (event.location || '').toLowerCase();
      const commonPatterns = [
        'meet.google.com',
        'zoom.us',
        'teams.microsoft.com',
        'webex.com'
      ];
      
      return commonPatterns.some(pattern => 
        description.includes(pattern) || location.includes(pattern)
      );
    }) || [];

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}