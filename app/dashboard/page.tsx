"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Video } from "lucide-react";
import { format } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  platform: string;
  autoJoin?: boolean;
  meetingLink?: string;
}

function groupMeetingsByDay(meetings: Meeting[]) {
  const groups: { [key: string]: Meeting[] } = {};

  meetings.forEach((meeting) => {
    const date = new Date(meeting.startTime);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateKey;
    if (date.toDateString() === today.toDateString()) {
      dateKey = "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateKey = "Tomorrow";
    } else {
      dateKey = format(date, "EEEE, MMMM d");
    }

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(meeting);
  });

  return groups;
}

function getMeetingPlatform(meetingLink: string): string {
  if (meetingLink.includes('meet.google.com')) return 'Google Meet';
  if (meetingLink.includes('zoom.us')) return 'Zoom';
  if (meetingLink.includes('teams.microsoft.com')) return 'Microsoft Teams';
  return 'Video Call';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoJoinStates, setAutoJoinStates] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (!user) {
      router.push("/signin");
      return;
    }

    const fetchMeetings = async () => {
      try {
        const response = await fetch('/api/calendar/events');
        if (!response.ok) {
          throw new Error('Failed to fetch meetings');
        }
        const data = await response.json();
        
        const transformedMeetings = data.events.map((event: any) => {
          const meetingLink = event.hangoutLink || 
            event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
          
          return {
            id: event.id,
            title: event.summary,
            startTime: event.start.dateTime,
            endTime: event.end.dateTime,
            platform: getMeetingPlatform(meetingLink || ''),
            meetingLink: meetingLink,
            autoJoin: false
          };
        }).filter((meeting: Meeting) => meeting.meetingLink);

        setMeetings(transformedMeetings);
      } catch (error) {
        console.error('Error fetching meetings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [user, router]);

  const handleAutoJoinToggle = (meetingId: string) => {
    setAutoJoinStates((prev) => ({
      ...prev,
      [meetingId]: !prev[meetingId],
    }));
  };

  if (!user) {
    return null;
  }

  const groupedMeetings = groupMeetingsByDay(meetings);

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading meetings...</div>
        ) : Object.entries(groupedMeetings).length > 0 ? (
          Object.entries(groupedMeetings).map(([date, dayMeetings]) => (
            <div key={date}>
              <h2 className="text-xl font-medium text-foreground mb-4">{date}</h2>
              <div className="space-y-4">
                {dayMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="bg-card rounded-lg border border-border p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-lg font-medium">{meeting.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(meeting.startTime), "h:mm")} - {format(new Date(meeting.endTime), "h:mm a")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Switch
                            checked={meeting.autoJoin || autoJoinStates[meeting.id]}
                            onCheckedChange={() => handleAutoJoinToggle(meeting.id)}
                          />
                          <span className="text-sm text-muted-foreground">Descript will automatically join</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="outline" 
                          className="text-sm" 
                          onClick={() => window.open(meeting.meetingLink, '_blank')}
                        >
                          <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 mr-2" />
                            {meeting.platform}
                            <span className="text-primary">→</span>
                          </div>
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No upcoming meetings with video links
          </div>
        )}
      </div>
    </div>
  );
}

