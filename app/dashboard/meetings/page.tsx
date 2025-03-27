"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, getFirestore } from "firebase/firestore";
import { useAuth } from "@/context/auth-context";
import { useSearch } from "@/src/context/search-context";
import { useMeetings } from "@/src/context/meetings-context";
import { format } from "date-fns";
import dynamic from "next/dynamic";

// Dynamically import icons with SSR disabled
const Calendar = dynamic(async () => (await import("lucide-react")).Calendar, {
  ssr: false,
});
const Clock = dynamic(async () => (await import("lucide-react")).Clock, {
  ssr: false,
});
const Users = dynamic(async () => (await import("lucide-react")).Users, {
  ssr: false,
});

interface ActionItem {
  text: string;
  completed?: boolean;
  assignee?: string;
  dueDate?: number;
}

interface SpeakerTranscript {
  speaker: string;
  text: string;
  timestamp: number;
  duration?: number;
}

interface MeetingData {
  id: string;
  actionItems: { [key: string]: ActionItem };
  audioURL: string;
  videoURL?: string;
  botId?: string;
  emoji: string;
  name: string;
  notes: string;
  speakerTranscript: { [key: string]: SpeakerTranscript };
  tags: string[];
  timestamp: number;
  transcript: string;
  title: string;
}

interface Meeting {
  id: string;
  actionItems: { [key: string]: ActionItem };
  audioURL: string;
  videoURL?: string;
  botId?: string;
  emoji: string;
  name: string;
  notes: string;
  speakerTranscript: { [key: string]: SpeakerTranscript };
  tags: string[];
  timestamp: number;
  transcript: string;
  title: string;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { searchQuery } = useSearch();
  const { refreshTrigger } = useMeetings();
  const auth = useAuth();

  useEffect(() => {
    setMounted(true);
    if (auth.user) {
      setUser(auth.user);
    }
  }, [auth.user]);

  useEffect(() => {
    console.log("refreshTrigger changed:", refreshTrigger);
  }, [refreshTrigger]);

  const fetchMeetings = useCallback(async () => {
    if (!user?.email) {
      console.log("No user email found, skipping fetch");
      setLoading(false);
      return;
    }

    console.log("Fetching meetings triggered by refreshTrigger:", refreshTrigger);
    setLoading(true);

    try {
      console.log("Fetching meetings for user:", user.email);

      // Initialize Firestore
      const firestore = getFirestore();
      const meetingsRef = collection(firestore, "transcript", user.email, "timestamps");
      const querySnapshot = await getDocs(query(meetingsRef));

      const meetingsData = querySnapshot.docs.map((doc) => {
        const data = doc.data();

        // Handle different timestamp formats
        let timestamp: number;
        if (data.timestamp?.seconds) {
          timestamp = data.timestamp.seconds * 1000;
        } else if (typeof data.timestamp === "number") {
          timestamp = data.timestamp;
        } else {
          timestamp = Date.now(); // fallback
        }

        return {
          id: doc.id,
          audioURL: data.audioURL || "",
          transcript: data.transcript || "",
          name: data.name || "Untitled Meeting",
          timestamp,
          tags: data.tags || [],
          title: data.title || data.name || "Untitled Meeting",
          emoji: data.emoji || "📝",
          notes: data.notes || "",
          actionItems: data.actionItems || {},
          speakerTranscript: data.speakerTranscript || {},
          videoURL: data.videoURL,
          botId: data.botId,
        } as Meeting;
      });

      // Sort meetings by timestamp from newest to oldest
      meetingsData.sort((a, b) => b.timestamp - a.timestamp);

      setMeetings(meetingsData);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.email, refreshTrigger]);

  useEffect(() => {
    if (mounted && user?.email) {
      fetchMeetings();
    }
  }, [mounted, user?.email, fetchMeetings, refreshTrigger]);

  if (!mounted) {
    // Skeleton loading state
    return (
      <div className="min-h-screen w-full bg-gray-50">
        <div className="px-4 py-6">
          <div className="h-8 bg-purple-50 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-purple-50 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allTags = Array.from(new Set(meetings.flatMap((meeting) => meeting.tags)));

  const filteredMeetings = meetings.filter((meeting) => {
    if (activeTag && !meeting.tags.includes(activeTag)) {
      return false;
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        meeting.title.toLowerCase().includes(searchLower) ||
        meeting.notes.toLowerCase().includes(searchLower) ||
        meeting.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  // Helper function for safe date formatting
  const formatDate = (timestamp: number | undefined, formatStr: string) => {
    try {
      if (!timestamp) {
        console.warn("Undefined timestamp encountered");
        return "Invalid date";
      }
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date from timestamp: ${timestamp}`);
        return "Invalid date";
      }
      return format(date, formatStr);
    } catch (error) {
      console.error("Error formatting date:", error, timestamp);
      return "Invalid date";
    }
  };

  const handleMeetingClick = (meeting: Meeting) => {
    router.push(`/dashboard/meetings/${meeting.id}`);
  };

  const content = (
    <>
      {/* Heading */}
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meetings</h1>
      </div>

      {/* Tag Filter Buttons */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={activeTag === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTag(null)}
          className={`rounded-full ${activeTag === null ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50 hover:text-purple-700 border-gray-200 dark:border-gray-700'}`}
        >
          All
        </Button>
        {allTags.map((tag) => (
          <Button
            key={tag}
            variant={activeTag === tag ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTag(tag)}
            className={`rounded-full ${activeTag === tag ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50 hover:text-purple-700 border-gray-200 dark:border-gray-700'}`}
          >
            {tag}
          </Button>
        ))}
      </div>

      {/* Meetings List */}
      <div className="space-y-6 w-full max-w-full">
        {filteredMeetings.map((meeting) => (
          <div
            key={`${meeting.id}-${meeting.timestamp}`}
            onClick={() => handleMeetingClick(meeting)}
            className="cursor-pointer w-full overflow-hidden rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-4 p-5">
              {/* Left side: Emoji with colored background */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                  <span className="text-2xl">{meeting.emoji}</span>
                </div>
              </div>

              {/* Middle: Content area */}
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate max-w-full">
                    {meeting.title}
                  </h3>
                </div>

                {/* Date, Time, Participants - in a row on larger screens */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-purple-500 dark:text-purple-400" />
                    <span>{formatDate(meeting.timestamp, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-purple-500 dark:text-purple-400" />
                    <span>{formatDate(meeting.timestamp, "h:mm a")}</span>
                  </div>
                  {meeting.speakerTranscript && (
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 flex-shrink-0 text-purple-500 dark:text-purple-400" />
                      <span>
                        {
                          new Set(
                            Object.values(meeting.speakerTranscript).map(
                              (s) => s.speaker
                            )
                          ).size
                        }{" "}
                        participants
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: Tags and action items count */}
              <div className="flex flex-col md:items-end gap-2 mt-2 md:mt-0">
                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  {meeting.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="rounded-full text-xs font-medium px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {meeting.tags.length > 3 && (
                    <Badge
                      variant="secondary"
                      className="rounded-full text-xs font-medium px-2.5 py-0.5 bg-gray-50 text-gray-600 border border-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                    >
                      +{meeting.tags.length - 3} more
                    </Badge>
                  )}
                </div>
                
                {/* Action items counter - if there are any */}
                {Object.keys(meeting.actionItems || {}).length > 0 && (
                  <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                    {Object.keys(meeting.actionItems).length} action item{Object.keys(meeting.actionItems).length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* No Meetings Found */}
        {filteredMeetings.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mb-4">
              <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No meetings found</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery 
                ? "No meetings match your current search criteria. Try adjusting your filters."
                : activeTag
                  ? `No meetings with the tag '${activeTag}' found.`
                  : "You don't have any recorded meetings yet. Your meetings will appear here once they're processed."}
            </p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <div className="max-w-screen-xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 animate-pulse rounded w-1/4 mb-8"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl w-full"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl w-full"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl w-full"></div>
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
