"use client"

import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';
import { Card } from "@/components/ui/card";
import confetti from 'canvas-confetti';

interface ActionItem {
  title: string;
  description: string;
  done: boolean;
}

interface Meeting {
  id: string;
  actionItems: ActionItem[];
  title: string;
}

export default function ActionItemsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActionItems = async () => {
      if (!user?.email) return;

      try {
        const db = getFirebaseDb();
        const timestampsRef = collection(db, 'transcript', user.email, 'timestamps');
        const timestampsSnapshot = await getDocs(timestampsRef);
        
        const meetingsWithActionItems = timestampsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            title: doc.data().title || doc.data().name || 'Untitled Meeting',
            actionItems: doc.data().actionItems || [],
          } as Meeting))
          .filter(meeting => meeting.actionItems && meeting.actionItems.length > 0);

        setMeetings(meetingsWithActionItems);
      } catch (error) {
        console.error('Error fetching action items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActionItems();
  }, [user?.email]);

  const handleToggleActionItem = async (meetingId: string, itemIndex: number, currentDone: boolean) => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const meetingRef = doc(db, 'transcript', user.email, 'timestamps', meetingId);

      // Update the specific action item in the array
      const updatedMeetings = meetings.map(meeting => {
        if (meeting.id === meetingId) {
          const updatedActionItems = [...meeting.actionItems];
          updatedActionItems[itemIndex] = {
            ...updatedActionItems[itemIndex],
            done: !currentDone
          };
          return { ...meeting, actionItems: updatedActionItems };
        }
        return meeting;
      });

      // If marking as done, trigger confetti
      if (!currentDone) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FF1A75', '#FF4D94', '#FF80B2', '#FFB3D1', '#FFE6F0']
        });
      }

      // Update Firestore
      const meeting = meetings.find(m => m.id === meetingId);
      if (meeting) {
        const updatedActionItems = [...meeting.actionItems];
        updatedActionItems[itemIndex] = {
          ...updatedActionItems[itemIndex],
          done: !currentDone
        };
        await updateDoc(meetingRef, {
          actionItems: updatedActionItems
        });
      }

      setMeetings(updatedMeetings);
    } catch (error) {
      console.error('Error updating action item:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading action items...</div>;
  }

  return (
    <div className="p-8 min-h-screen bg-background">
      <h1 className="text-3xl font-bold mb-8 text-foreground">Action Items</h1>
      <div className="space-y-8">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="p-6 shadow-sm border-border bg-white/50 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-foreground mb-6">
              {meeting.title}
            </h2>
            <div className="space-y-4">
              {meeting.actionItems.map((item, index) => (
                <div 
                  key={`${meeting.id}-${index}`} 
                  className="flex items-start space-x-4 p-4 rounded-xl hover:bg-accent/50 transition-colors duration-200"
                >
                  <Checkbox 
                    checked={item.done} 
                    onCheckedChange={() => handleToggleActionItem(meeting.id, index, item.done)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className={cn(
                      "text-base font-medium text-foreground",
                      item.done && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className={cn(
                        "text-base text-muted-foreground mt-2",
                        item.done && "line-through opacity-50"
                      )}>
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {meetings.length === 0 && (
          <Card className="py-12 text-center text-muted-foreground bg-white/50">
            <p className="text-lg">
              No action items found.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

