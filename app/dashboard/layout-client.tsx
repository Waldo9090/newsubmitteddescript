"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Calendar,
  CheckSquare,
  Share2,
  BarChart2,
  Settings,
  Search,
  PlusCircle,
  Mic,
  Upload,
  UserPlus,
  CreditCard,
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ChatColumn } from '@/components/chat/ChatColumn';
import { useState, useEffect } from "react";
import RecordDialog from "@/app/dialogs/RecordDialog";
import ImportDialog from "@/app/dialogs/ImportDialog";
import InviteDialog from "@/app/dialogs/InviteDialog";
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useSearch } from '@/src/context/search-context';
import { useMeetings } from '@/src/context/meetings-context';
import { MeetingsProvider } from '@/src/context/meetings-context';
import { SearchProvider } from "@/src/context/search-context";
import type { ChangeEvent, MouseEvent } from 'react';

// Define the meeting interface
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { searchQuery, setSearchQuery } = useSearch();
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const isViewingMeeting = pathname.startsWith('/dashboard/meetings/') && pathname !== '/dashboard/meetings';
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const refreshMeetings = () => {
    setRefreshTrigger((prev: number) => prev + 1);
  };

  // Fetch meeting data when viewing a specific meeting
  useEffect(() => {
    const fetchMeetingData = async () => {
      if (!isViewingMeeting || !currentMeeting || !user?.email) {
        setCurrentMeeting(null);
        return;
      }

      try {
        const firestore = getFirestore();
        const meetingRef = doc(firestore, 'transcript', user.email, 'timestamps', currentMeeting.id);
        const meetingSnap = await getDoc(meetingRef);
        
        if (meetingSnap.exists()) {
          const data = meetingSnap.data();
          
          // Handle different timestamp formats
          let timestamp: number;
          if (data.timestamp?.seconds) {
            timestamp = data.timestamp.seconds * 1000;
          } else if (typeof data.timestamp === 'number') {
            timestamp = data.timestamp;
          } else {
            timestamp = Date.now();
          }

          const meetingData = {
            id: currentMeeting.id,
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

          setCurrentMeeting(meetingData);
        } else {
          setCurrentMeeting(null);
        }
      } catch (error) {
        console.error('Error fetching meeting data:', error);
        setCurrentMeeting(null);
      }
    };

    fetchMeetingData();
  }, [isViewingMeeting, currentMeeting, user?.email]);

  const isIntegrationsPage = pathname.startsWith('/dashboard/integrations');

  const sidebarItems = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Calendar, label: "Meetings", href: "/dashboard/meetings" },
    { icon: CheckSquare, label: "Action Items", href: "/dashboard/action-items" },
    { icon: Share2, label: "Integrations", href: "/dashboard/integrations" },
    { icon: BarChart2, label: "Insights", href: "/dashboard/insights" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <SearchProvider>
      <MeetingsProvider>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar>
              <SidebarHeader className="p-4 border-b">
                <Link href="/" className="flex items-center">
                  <span className="text-xl font-bold">
                    <span className="text-primary">Descript</span>
                    <span className="text-foreground">AI</span>
                  </span>
                </Link>
              </SidebarHeader>
              <SidebarContent>
                <div className="py-4">
                  <SidebarMenu className="space-y-2 px-2">
                    {sidebarItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href} legacyBehavior passHref>
                          <SidebarMenuButton asChild isActive={isActive(item.href)}>
                            <a>
                              <item.icon className="h-5 w-5 mr-3" />
                              <span className="font-medium">{item.label}</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              </SidebarContent>
              <SidebarFooter className="p-4 border-t mt-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      <span>Account</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem>
                      <Link href="/dashboard/settings/billing" className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Manage billing</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <button
                        onClick={async () => {
                          try {
                            await signOut();
                            window.location.href = '/';
                          } catch (error) {
                            console.error('Error signing out:', error);
                          }
                        }}
                        className="w-full flex items-center"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarFooter>
            </Sidebar>

            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="fixed top-0 right-0 left-[240px] h-16 border-b border-border bg-background z-50">
                <div className="absolute inset-0 flex items-center px-6">
                  <div className="flex items-center flex-1">
                    <SidebarTrigger />
                    <div className="ml-[24px] w-full max-w-2xl">
                      <div className="relative w-full">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="Search or ask a question..."
                          className="pl-8 w-full pr-4"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="fixed top-4 right-6 z-50">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full shadow-lg 
                          transform transition-all duration-200 hover:scale-105 active:scale-95
                          animate-button-glow hover:shadow-primary/25 hover:shadow-xl
                          relative after:absolute after:inset-0 after:rounded-full after:border-2 
                          after:border-primary/50 after:animate-button-pulse
                          text-lg py-6 px-6"
                        >
                          <PlusCircle className="mr-2 h-5 w-5 transition-transform group-hover:rotate-90 duration-200" />
                          New meeting
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 p-2">
                        <DropdownMenuItem 
                          onClick={() => setIsRecordOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 mr-3">
                            <Mic className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Record</div>
                            <div className="text-sm text-muted-foreground">Record a new meeting</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsImportOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 mr-3">
                            <Upload className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Import</div>
                            <div className="text-sm text-muted-foreground">Import existing recording</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsInviteOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 mr-3">
                            <UserPlus className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Invite Descript</div>
                            <div className="text-sm text-muted-foreground">Add to calendar events</div>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </header>
              <main className="flex-1 overflow-auto pt-16">
                {children}
              </main>
            </div>
          </div>

          {/* Dialog Components */}
          <RecordDialog open={isRecordOpen} onOpenChange={setIsRecordOpen} />
          <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
          <InviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
        </SidebarProvider>
      </MeetingsProvider>
    </SearchProvider>
  );
}

// Add these keyframe animations at the end of the file, before the last closing brace
const styles = `
  @keyframes button-glow {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  @keyframes button-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.1);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
`;

// Add style tag to the document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 