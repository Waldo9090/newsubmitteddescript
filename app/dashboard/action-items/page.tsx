"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, Circle, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

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
      <div className="p-8 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Action Items</h1>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Action Items 
            <span className="ml-3 text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 py-1 px-2.5 rounded-full">
              {filteredActionItems.length}
            </span>
          </h1>
          
          <div className="flex space-x-2">
            <Badge 
              variant={filter === "all" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${filter === "all" ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50 hover:text-purple-700'}`}
              onClick={() => setFilter("all")}
            >
              All
            </Badge>
            <Badge 
              variant={filter === "pending" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${filter === "pending" ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50 hover:text-purple-700'}`}
              onClick={() => setFilter("pending")}
            >
              Pending
            </Badge>
            <Badge 
              variant={filter === "completed" ? "default" : "outline"} 
              className={`cursor-pointer px-3 py-1 rounded-full text-sm ${filter === "completed" ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50 hover:text-purple-700'}`}
              onClick={() => setFilter("completed")}
            >
              Completed
            </Badge>
          </div>
        </div>

        {filteredActionItems.length === 0 ? (
          <Card className="p-12 text-center border border-border bg-white dark:bg-gray-900 shadow-sm rounded-xl">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                {filter === "all" 
                  ? "No action items found" 
                  : filter === "pending" 
                    ? "No pending action items" 
                    : "No completed action items"}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {filter === "all" 
                  ? "Action items from your meetings will appear here." 
                  : filter === "pending" 
                    ? "All your action items have been completed! Great job!" 
                    : "You haven't completed any action items yet."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredActionItems.map((item, index) => (
              <Card 
                key={`${item.meetingId}-${item.itemIndex}`} 
                className={cn(
                  "border border-border bg-white dark:bg-gray-900 shadow-sm hover:shadow transition-all duration-200 rounded-xl overflow-hidden",
                  item.done && "bg-gray-50/80 dark:bg-gray-900/50"
                )}
              >
                <div className="flex items-start p-5 gap-4">
                  <div className="flex-shrink-0 pt-1">
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={() =>
                        handleToggleActionItem(item.meetingId, item.itemIndex, item.done)
                      }
                      className={cn(
                        "h-6 w-6 rounded-full border-2",
                        item.done 
                          ? "border-purple-500 bg-purple-500 text-white" 
                          : "border-gray-300 dark:border-gray-600"
                      )}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <h3
                        className={cn(
                          "text-lg font-medium text-gray-900 dark:text-gray-100",
                          item.done && "line-through text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {item.title}
                      </h3>
                      
                      <div className="flex items-center gap-2">
                        {item.meetingTimestamp && (
                          <div className="flex items-center text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                            <Calendar className="h-3 w-3 mr-1.5 text-purple-500 dark:text-purple-400" />
                            {formatDate(item.meetingTimestamp)}
                          </div>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <MoreHorizontal className="h-4 w-4 text-gray-500" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleToggleActionItem(item.meetingId, item.itemIndex, item.done)}
                            >
                              {item.done ? "Mark as incomplete" : "Mark as complete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    {item.description && (
                      <p
                        className={cn(
                          "text-base text-gray-700 dark:text-gray-300 mt-2",
                          item.done && "line-through text-gray-500 dark:text-gray-400 opacity-70"
                        )}
                      >
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center mt-3 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 mr-1.5 text-yellow-500" />
                        )}
                        <span>{item.done ? "Completed" : "In progress"}</span>
                      </div>
                      <span className="mx-2">•</span>
                      <span>From: {item.meetingTitle}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
