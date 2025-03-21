"use client"

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { Button } from "@/components/ui/button";
import { MeetingDetail } from "../../../components/meeting-detail";

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

export default function MeetingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeeting = async () => {
      if (!user?.email) {
        console.log('No user email found, skipping fetch');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching meeting with ID:', params.id);
        console.log('User email:', user.email);
        
        // Initialize Firestore
        const firestore = getFirestore();
        
        // Get the meeting document
        const meetingRef = doc(firestore, 'transcript', user.email, 'timestamps', params.id);
        console.log('Meeting reference path:', meetingRef.path);
        
        const meetingSnap = await getDoc(meetingRef);
        console.log('Meeting exists:', meetingSnap.exists());
        
        if (meetingSnap.exists()) {
          const data = meetingSnap.data();
          console.log('Meeting data:', data);
          
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
            console.warn(`Invalid timestamp for meeting ${params.id}, using current time`);
          }

          const meetingData = {
            id: params.id,
            audioURL: data.audioURL || '',
            transcript: data.transcript || '',
            name: data.name || 'Untitled Meeting',
            timestamp,
            tags: data.tags || [],
            title: data.name || 'Untitled Meeting',
            emoji: data.emoji || '📝',
            notes: data.notes || '',
            actionItems: data.actionItems || {},
            speakerTranscript: data.speakerTranscript || {},
            videoURL: data.videoURL,
            botId: data.botId
          };

          console.log('Processed meeting data:', meetingData);
          setMeeting(meetingData);
        } else {
          console.error('Meeting not found with ID:', params.id);
        }
      } catch (error) {
        console.error('Error fetching meeting:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeeting();
  }, [params.id, user?.email]);

  if (loading) {
    return (
      <div className="p-6 w-full">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-6 w-full">
        <Button variant="ghost" onClick={() => router.push('/dashboard/meetings')} className="mb-4">
          ← Back to meetings
        </Button>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Meeting Not Found</h2>
          <p className="text-muted-foreground">The meeting you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/meetings')}>
          ← Back to meetings
        </Button>
        {meeting.actionItems && Object.keys(meeting.actionItems).length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard/action-items')}
            className="flex items-center gap-2"
          >
            View Action Items
          </Button>
        )}
      </div>
      <MeetingDetail 
        meeting={meeting} 
        onClose={() => router.push('/dashboard/meetings')} 
        onDelete={() => router.push('/dashboard/meetings')}
      />
    </div>
  );
} 