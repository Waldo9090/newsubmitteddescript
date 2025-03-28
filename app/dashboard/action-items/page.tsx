"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ActionItem {
  title: string;
  description: string;
  done: boolean;
  completed?: boolean;
  createdAt?: number;
  dueDate?: number;
  text?: string;
}

interface Meeting {
  id: string;
  actionItems: ActionItem[];
  title: string;
  timestamp?: number;
}

interface SingleActionItem {
  meetingId: string;
  itemIndex: number;
  meetingTitle: string;
  title: string;
  description: string;
  done: boolean;
  meetingTimestamp?: number;
  createdAt?: number;
  dueDate?: number;
}

// Function to safely trigger confetti
const triggerConfetti = () => {
  try {
    // Dynamic import only on client side
    const confetti = require('canvas-confetti');
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#4B5563", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6"],
    });
  } catch (error) {
    console.error('Failed to load confetti:', error);
  }
};

export default function ActionItemsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [actionItems, setActionItems] = useState<SingleActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [editingItem, setEditingItem] = useState<SingleActionItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    const fetchActionItems = async () => {
      if (!user?.email) return;

      try {
        const db = getFirebaseDb();
        const timestampsRef = collection(db, "transcript", user.email, "timestamps");
        const timestampsSnapshot = await getDocs(query(timestampsRef));

        const meetingsWithActionItems = timestampsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            title: doc.data().title || doc.data().name || "Untitled Meeting",
            actionItems: doc.data().actionItems || [],
            timestamp: doc.data().timestamp?.seconds ? doc.data().timestamp.seconds * 1000 : undefined,
          }))
          // Only keep meetings that actually have action items
          .filter((meeting) => meeting.actionItems && Object.keys(meeting.actionItems).length > 0);

        // Combine all action items from every meeting into a single array
        const allActionItems: SingleActionItem[] = [];
        meetingsWithActionItems.forEach((meeting) => {
          Object.entries(meeting.actionItems).forEach(([index, item]: [string, any]) => {
            allActionItems.push({
              meetingId: meeting.id,
              itemIndex: parseInt(index),
              meetingTitle: meeting.title,
              meetingTimestamp: meeting.timestamp,
              title: item.text || item.title || "Untitled Action Item",
              description: item.description || "",
              done: item.completed || item.done || false,
              createdAt: item.createdAt?.seconds ? item.createdAt.seconds * 1000 : meeting.timestamp,
              dueDate: item.dueDate,
            });
          });
        });

        // Sort by completion status and then by creation date (newest first)
        allActionItems.sort((a, b) => {
          if (a.done !== b.done) {
            return a.done ? 1 : -1; // Incomplete items first
          }
          // Sort by meeting timestamp (newest first) if available
          return (b.meetingTimestamp || 0) - (a.meetingTimestamp || 0);
        });

        setMeetings(meetingsWithActionItems);
        setActionItems(allActionItems);
      } catch (error) {
        console.error("Error fetching action items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActionItems();
  }, [user?.email]);

  const handleToggleActionItem = async (
    meetingId: string,
    itemIndex: number,
    currentDone: boolean
  ) => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const meetingRef = doc(db, "transcript", user.email, "timestamps", meetingId);

      // Update 'meetings' so we can correctly update Firestore
      const updatedMeetings = meetings.map((meeting) => {
        if (meeting.id === meetingId) {
          const updatedItems = { ...meeting.actionItems };
          updatedItems[itemIndex] = { 
            ...updatedItems[itemIndex], 
            done: !currentDone,
            completed: !currentDone 
          };
          return { ...meeting, actionItems: updatedItems };
        }
        return meeting;
      });

      // Fire confetti when item is marked as done
      if (!currentDone) {
        triggerConfetti();
      }

      // Update Firestore
      const targetMeeting = updatedMeetings.find((m) => m.id === meetingId);
      if (targetMeeting) {
        await updateDoc(meetingRef, { actionItems: targetMeeting.actionItems });
      }

      // Update local 'actionItems'
      const updatedActionItems = actionItems.map((item) => {
        if (item.meetingId === meetingId && item.itemIndex === itemIndex) {
          return { ...item, done: !currentDone };
        }
        return item;
      });

      setMeetings(updatedMeetings);
      setActionItems(updatedActionItems);
    } catch (error) {
      console.error("Error updating action item:", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!user?.email || !editingItem) return;

    try {
      const db = getFirebaseDb();
      const meetingRef = doc(db, "transcript", user.email, "timestamps", editingItem.meetingId);

      // Update the meetings state
      const updatedMeetings = meetings.map((meeting) => {
        if (meeting.id === editingItem.meetingId) {
          const updatedItems = { ...meeting.actionItems };
          updatedItems[editingItem.itemIndex] = {
            ...updatedItems[editingItem.itemIndex],
            text: editTitle, // Update both text and title for compatibility
            title: editTitle,
            description: editDescription
          };
          return { ...meeting, actionItems: updatedItems };
        }
        return meeting;
      });

      // Update Firestore
      const targetMeeting = updatedMeetings.find((m) => m.id === editingItem.meetingId);
      if (targetMeeting) {
        await updateDoc(meetingRef, { actionItems: targetMeeting.actionItems });
      }

      // Update local actionItems state
      const updatedActionItems = actionItems.map((item) => {
        if (item.meetingId === editingItem.meetingId && item.itemIndex === editingItem.itemIndex) {
          return { ...item, title: editTitle, description: editDescription };
        }
        return item;
      });

      setMeetings(updatedMeetings);
      setActionItems(updatedActionItems);
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating action item:", error);
    }
  };

  // Filter action items based on the current filter
  const filteredActionItems = actionItems.filter(item => {
    if (filter === "all") return true;
    if (filter === "pending") return !item.done;
    if (filter === "completed") return item.done;
    return true;
  });

  // Helper to format dates
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "MMM d, yyyy");
  };

  if (loading) {
    return (
      <div className="p-8 min-h-screen bg-white">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Action Items</h1>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Action Items 
            <span className="ml-3 text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 py-1 px-2.5 rounded-full">
              {filteredActionItems.length}
            </span>
          </h1>
          
          <div className="flex space-x-2">
            <Badge 
              variant={filter === "all" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${
                filter === "all" 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={() => setFilter("all")}
            >
              All
            </Badge>
            <Badge 
              variant={filter === "pending" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${
                filter === "pending" 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={() => setFilter("pending")}
            >
              Pending
            </Badge>
            <Badge 
              variant={filter === "completed" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${
                filter === "completed" 
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                  : 'hover:bg-gray-50 hover:text-gray-700'
              }`}
              onClick={() => setFilter("completed")}
            >
              Completed
            </Badge>
          </div>
        </div>

        {filteredActionItems.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-gray-900">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-gray-600 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                No action items found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {filter === "completed" 
                  ? "You haven't completed any action items yet."
                  : filter === "pending"
                    ? "You don't have any pending action items."
                    : "Start by recording or importing a meeting."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredActionItems.map((item, index) => (
              <div
                key={`${item.meetingId}-${item.itemIndex}`}
                className="py-6 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 pt-1">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() => handleToggleActionItem(item.meetingId, item.itemIndex, item.done)}
                      className={cn(
                        "h-5 w-5 rounded-full border-2",
                        item.done 
                          ? "bg-purple-100 border-purple-200 text-purple-500" 
                          : "border-gray-300"
                      )}
                    />
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      setEditingItem(item);
                      setEditTitle(item.title);
                      setEditDescription(item.description);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={cn(
                          "text-base font-medium mb-1",
                          item.done 
                            ? "text-gray-500 line-through" 
                            : "text-gray-900 dark:text-white"
                        )}>
                          {item.title}
                        </h3>
                        <p className={cn(
                          "text-sm",
                          item.done 
                            ? "text-gray-400" 
                            : "text-gray-600 dark:text-gray-300"
                        )}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        From <span className="text-gray-700">{item.meetingTitle}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
