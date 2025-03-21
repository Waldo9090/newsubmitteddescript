"use client"

import React from 'react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/auth-context'
import { collection, getDocs, query, getFirestore } from 'firebase/firestore'
import { useSearch } from '@/src/context/search-context';
import { useMeetings } from '@/src/context/meetings-context';
import { format } from "date-fns"

// Dynamically import Lucide icons with no SSR
const Calendar = dynamic(() => import('lucide-react').then(mod => mod.Calendar), { ssr: false });
const Clock = dynamic(() => import('lucide-react').then(mod => mod.Clock), { ssr: false });
const Users = dynamic(() => import('lucide-react').then(mod => mod.Users), { ssr: false });
const Search = dynamic(() => import('lucide-react').then(mod => mod.Search), { ssr: false });

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
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const { searchQuery } = useSearch();
  const { refreshTrigger } = useMeetings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("Component mounted");
  }, []);

  useEffect(() => {
    console.log("refreshTrigger changed:", refreshTrigger);
  }, [refreshTrigger]);

  const fetchMeetings = useCallback(async () => {
    if (!user?.email) {
      console.log('No user email found, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('Fetching meetings triggered by refreshTrigger:', refreshTrigger);
    setLoading(true);
    
    try {
      console.log('Fetching meetings for user:', user.email);
      
      // Initialize Firestore
      const firestore = getFirestore();
      
      // Create collection reference
      const meetingsRef = collection(firestore, 'transcript', user.email, 'timestamps');
      
      const querySnapshot = await getDocs(query(meetingsRef));
      console.log('Query snapshot size:', querySnapshot.size);

      const meetingsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Meeting data for ID', doc.id, ':', data);

        // Handle different timestamp formats
        let timestamp: number;
        if (data.timestamp?.seconds) {
          // Firestore timestamp object
          timestamp = data.timestamp.seconds * 1000;
        } else if (typeof data.timestamp === 'number') {
          // Milliseconds timestamp
          timestamp = data.timestamp;
        } else {
          // Fallback to current time
          timestamp = Date.now();
        }

        return {
          id: doc.id,
          audioURL: data.audioURL || '',
          transcript: data.transcript || '',
          name: data.name || 'Untitled Meeting',
          timestamp,
          tags: data.tags || [],
          title: data.title || data.name || 'Untitled Meeting',
          emoji: data.emoji || '📝',
          notes: data.notes || '',
          actionItems: data.actionItems || {},
          speakerTranscript: data.speakerTranscript || {},
          videoURL: data.videoURL,
          botId: data.botId
        } as Meeting;
      });

      console.log('Total meetings found:', meetingsData.length);
      setMeetings(meetingsData);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.email, refreshTrigger]);

  useEffect(() => {
    if (mounted && user?.email) {
      console.log("Calling fetchMeetings because mounted or refreshTrigger changed");
      fetchMeetings();
    }
  }, [mounted, user?.email, fetchMeetings, refreshTrigger]);

  if (!mounted || loading) {
    return (
      <div className="p-6 w-full">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allTags = Array.from(new Set(meetings.flatMap((meeting) => meeting.tags)))
  const filteredMeetings = meetings.filter(meeting => {
    // First filter by active tag if one is selected
    if (activeTag && !meeting.tags.includes(activeTag)) {
      return false;
    }
    
    // Then filter by search query if one exists
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      return (
        meeting.title.toLowerCase().includes(searchLower) ||
        meeting.notes.toLowerCase().includes(searchLower) ||
        meeting.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    return true;
  });

  // Add a more robust helper function for safe date formatting
  const formatDate = (timestamp: number | undefined, formatStr: string) => {
    try {
      // Handle undefined or invalid timestamps
      if (!timestamp) {
        console.warn('Undefined timestamp encountered');
        return 'Invalid date';
      }
      
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date from timestamp: ${timestamp}`);
        return 'Invalid date';
      }
      
      return format(date, formatStr);
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return 'Invalid date';
    }
  };

  const handleMeetingClick = (meeting: Meeting) => {
    router.push(`/dashboard/meetings/${meeting.id}`);
  };

  const content = (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Meetings</h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button 
          variant={activeTag === null ? "default" : "outline"} 
          size="sm" 
          onClick={() => setActiveTag(null)}
        >
          All
        </Button>
        {allTags.map((tag) => (
          <Button
            key={tag}
            variant={activeTag === tag ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTag(tag)}
          >
            {tag}
          </Button>
        ))}
      </div>

      <div className="space-y-4 w-full">
        {filteredMeetings.map((meeting) => (
          <Card
            key={`${meeting.name}-${meeting.timestamp}`}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer w-full"
            onClick={() => handleMeetingClick(meeting)}
          >
            <div className="flex items-start justify-between w-full">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{meeting.emoji}</span>
                  <h3 className="text-lg font-medium">{meeting.title}</h3>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(meeting.timestamp, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(meeting.timestamp, "h:mm a")}</span>
                  </div>
                  {meeting.speakerTranscript && (
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {new Set(Object.values(meeting.speakerTranscript).map(s => s.speaker)).size} participants
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {meeting.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {filteredMeetings.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No meetings found matching your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );

  return content;
}

