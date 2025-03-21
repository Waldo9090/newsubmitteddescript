"use client"

import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

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
            ...doc.data(),
          }))
          .filter(meeting => meeting.actionItems && meeting.actionItems.length > 0);

        setMeetings(meetingsWithActionItems as Meeting[]);
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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Action Items</h1>
      <div className="space-y-6">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="space-y-2">
            <h2 className="text-lg font-semibold text-muted-foreground mb-4">
              {meeting.title}
            </h2>
            {meeting.actionItems.map((item, index) => (
              <div 
                key={`${meeting.id}-${index}`} 
                className="flex items-start space-x-2 p-2 rounded-lg hover:bg-accent/5"
              >
                <Checkbox 
                  checked={item.done} 
                  onCheckedChange={() => handleToggleActionItem(meeting.id, index, item.done)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    item.done && "line-through text-muted-foreground"
                  )}>
                    {item.title}
                  </p>
                  <p className={cn(
                    "text-sm text-muted-foreground mt-1",
                    item.done && "line-through"
                  )}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
        {meetings.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No action items found.
          </p>
        )}
      </div>
    </div>
  );
}

