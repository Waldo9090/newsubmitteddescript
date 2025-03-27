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
  Moon,
  Sun,
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
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useSearch } from '@/src/context/search-context';
import { useMeetings } from '@/src/context/meetings-context';
import { MeetingsProvider } from '@/src/context/meetings-context';
import { SearchProvider } from "@/src/context/search-context";
import { useTheme } from "next-themes";
import type { ChangeEvent, MouseEvent } from 'react';

// Dynamically import dialogs to prevent them from being loaded during static rendering
const RecordDialog = dynamic(() => import("@/app/dialogs/RecordDialog"), { 
  ssr: false,
  loading: () => <div>Loading...</div>
});
const ImportDialog = dynamic(() => import("@/app/dialogs/ImportDialog"), { 
  ssr: false,
  loading: () => <div>Loading...</div>
});
const InviteDialog = dynamic(() => import("@/app/dialogs/InviteDialog"), { 
  ssr: false 
});

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
  const { theme, setTheme } = useTheme();

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
            <Sidebar className="border-r border-border bg-card/40 backdrop-blur-sm">
              <SidebarHeader className="p-5 border-b border-border/40">
                <Link href="/" className="flex items-center">
                  <span className="text-xl font-bold tracking-tight">
                    <span className="text-primary">Descript</span>
                    <span className="text-foreground">AI</span>
                  </span>
                </Link>
              </SidebarHeader>
              <SidebarContent>
                <div className="py-6">
                  <SidebarMenu className="space-y-1.5 px-3">
                    {sidebarItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href as any} passHref>
                          <SidebarMenuButton
                            asChild={false}
                            isActive={isActive(item.href)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent/50"
                          >
                            <item.icon className={`h-[18px] w-[18px] ${isActive(item.href) ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className={isActive(item.href) ? 'text-foreground' : 'text-muted-foreground'}>
                              {item.label}
                            </span>
                            {item.label === "Integrations" && isIntegrationsPage && (
                              <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                                3
                              </span>
                            )}
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </div>
              </SidebarContent>
              <SidebarFooter className="p-4 border-t border-border/40 mt-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start space-x-2 px-3 py-6 h-auto">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col items-start text-left">
                          <span className="text-sm font-medium">{user?.displayName || user?.email?.split('@')[0] || 'User'}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {user?.email || 'user@example.com'}
                          </span>
                        </div>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href={"/dashboard/settings/billing" as any} className="flex w-full items-center">
                        <div className="flex h-8 w-8 items-center justify-center mr-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Billing</span>
                          <span className="text-xs text-muted-foreground">Manage your subscription</span>
                        </div>
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
                        <div className="flex h-8 w-8 items-center justify-center mr-2">
                          <LogOut className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">Sign out</span>
                          <span className="text-xs text-muted-foreground">Log out of your account</span>
                        </div>
                      </button>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarFooter>
            </Sidebar>

            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="fixed top-0 right-0 left-[240px] h-16 border-b border-border bg-background/80 backdrop-blur-sm z-50">
                <div className="h-full flex items-center justify-between px-6">
                  <div className="flex items-center flex-1">
                    <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground" />
                    <div className="relative w-full max-w-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground/60" />
                      </div>
                      <Input
                        type="text"
                        placeholder="Search or ask a question..."
                        className="w-full pl-10 pr-4 h-10 bg-muted/40 border-muted text-sm rounded-xl transition-colors focus:bg-background"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="p-2 rounded-full bg-accent hover:bg-accent/80 transition-colors duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="bg-primary text-primary-foreground shadow-lg rounded-full
                          transform transition-all duration-200 hover:scale-105 active:scale-95
                          hover:shadow-primary/25 hover:shadow-xl
                          relative after:absolute after:inset-0 after:rounded-full after:border-2 
                          after:border-primary/20 after:animate-button-pulse
                          text-sm font-medium py-2 px-4 flex items-center gap-2"
                        >
                          <div className="flex items-center justify-center bg-white/20 h-5 w-5 rounded-full">
                            <PlusCircle className="h-4 w-4" />
                          </div>
                          <span>New meeting</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[280px] p-2">
                        <DropdownMenuItem 
                          onClick={() => setIsRecordOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 mr-3 text-rose-600 dark:text-rose-400">
                            <Mic className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Record meeting</div>
                            <div className="text-sm text-muted-foreground">Record audio and video</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsImportOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 mr-3 text-blue-600 dark:text-blue-400">
                            <Upload className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Import recording</div>
                            <div className="text-sm text-muted-foreground">Upload audio or video file</div>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsInviteOpen(true)}
                          className="flex items-center p-3 hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mr-3 text-emerald-600 dark:text-emerald-400">
                            <UserPlus className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium text-base">Invite to calendar</div>
                            <div className="text-sm text-muted-foreground">Add DescriptAI to meetings</div>
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
          <Suspense fallback={<div>Loading...</div>}>
            <RecordDialog open={isRecordOpen} onOpenChange={setIsRecordOpen} />
          </Suspense>
          <Suspense fallback={<div>Loading...</div>}>
            <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
          </Suspense>
          <Suspense fallback={<div>Loading...</div>}>
            <InviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
          </Suspense>
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