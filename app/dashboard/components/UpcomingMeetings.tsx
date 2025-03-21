"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { Calendar, Video } from 'lucide-react';

interface Meeting {
  id: string;
  summary: string;
  start: {
    dateTime: string;
  };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints: {
      uri: string;
      entryPointType: string;
    }[];
  };
}

export default function UpcomingMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await fetch('/api/calendar/events');
        if (!response.ok) {
          throw new Error('Failed to fetch meetings');
        }
        const data = await response.json();
        setMeetings(data.events);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load meetings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  const getMeetingLink = (meeting: Meeting) => {
    return meeting.hangoutLink || 
           meeting.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Failed to load meetings. Please try again later.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Meetings</CardTitle>
          <CardDescription>Loading your meetings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Upcoming Meetings</CardTitle>
            <CardDescription>Your scheduled video meetings</CardDescription>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming meetings with video links</p>
        ) : (
          <div className="space-y-4">
            {meetings.map(meeting => {
              const meetingLink = getMeetingLink(meeting);
              if (!meetingLink) return null;

              return (
                <div key={meeting.id} className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{meeting.summary}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(meeting.start.dateTime).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(meetingLink, '_blank')}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

