'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ReactAudioPlayer from 'react-audio-player';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { collection, doc, getDocs, updateDoc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, Copy, Check, MoreVertical, Bot, Volume2, FileText, User, FileX, Pencil, Plus, X, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { AIChat } from './ai-chat';
import { EditableContent } from './editable-content';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { debounce } from 'lodash';
import { CreateActionItemDialog } from './create-action-item-dialog';
import { Textarea } from "@/components/ui/textarea";

interface ActionItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

interface SpeakerTranscript {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface MeetingData {
  id: string;
  actionItems: ActionItem[];
  audioURL: string;
  videoURL?: string;
  botId?: string;
  emoji: string;
  name: string;
  notes: string;
  speakerTranscript: SpeakerTranscript[];
  tags: string[];
  timestamp: number;
  timestampMs: number;
  transcript: string;
  title: string;
  type: string;
}

interface MeetingDetailProps {
  meeting: MeetingData;
  onClose: () => void;
  onDelete?: () => void;
  fullScreen?: boolean;
}

export function MeetingDetail({ meeting: initialMeeting, onClose, onDelete, fullScreen = false }: MeetingDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meeting, setMeeting] = useState<MeetingData>(initialMeeting);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(meeting.tags);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [copied, setCopied] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [isSyncingAttio, setIsSyncingAttio] = useState(false);
  const [attioSyncStatus, setAttioSyncStatus] = useState<'none' | 'success' | 'error' | 'not-connected'>('none');
  const [showAttioConnectDialog, setShowAttioConnectDialog] = useState(false);
  const [showCreateActionItem, setShowCreateActionItem] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(meeting.notes);
  const [editedTranscript, setEditedTranscript] = useState(meeting.transcript);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Fetch video recording if botId is available
  useEffect(() => {
    async function fetchVideoRecording() {
      if (!meeting.botId) return;
      
      setIsLoadingVideo(true);
      try {
        const response = await fetch(`/api/meetings/${meeting.botId}/recording`);
        if (!response.ok) {
          throw new Error('Failed to fetch recording');
        }
        
        const data = await response.json();
        setVideoURL(data.url);
      } catch (error) {
        console.error('Error fetching video recording:', error);
      } finally {
        setIsLoadingVideo(false);
      }
    }

    fetchVideoRecording();
  }, [meeting.botId]);

  // Load all tags from Firestore
  useEffect(() => {
    async function fetchTags() {
      if (!user?.email) return;

      try {
        // Get the user's tags document
        const userTagsRef = doc(getFirebaseDb(), 'tags', user.email);
        const userTagsSnap = await getDoc(userTagsRef);
        
        if (userTagsSnap.exists()) {
          const data = userTagsSnap.data();
          if (data.tags) {
            setAllTags(data.tags);
          }
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    }

    fetchTags();
  }, [user?.email]);

  // Save tags to Firestore
  async function handleSaveTags() {
    // Close the tag selector immediately
    setShowTagSelector(false);
    
    try {
      if (!user?.email) return;

      // Update meeting's tags
      meeting.tags = [...selectedTags];
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        tags: selectedTags
      });
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  }

  // Add new tag to both local state and Firestore
  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newTag.trim() || !user?.email) return;

    const tagToAdd = newTag.trim();
    
    try {
      // Update global tags in Firestore
      const globalTagsRef = doc(getFirebaseDb(), 'tags', user.email);
      const globalTagsSnap = await getDoc(globalTagsRef);
      
      let updatedTags: string[];
      
      if (globalTagsSnap.exists()) {
        const data = globalTagsSnap.data();
        updatedTags = [...new Set([...(data.tags || []), tagToAdd])];
        await updateDoc(globalTagsRef, { tags: updatedTags });
      } else {
        updatedTags = [tagToAdd];
        await setDoc(globalTagsRef, { tags: updatedTags });
      }

      // Update local state
      setAllTags(updatedTags);
      setSelectedTags(prev => [...new Set([...prev, tagToAdd])]);
      setNewTag("");

      // Update meeting's tags
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        tags: [...new Set([...selectedTags, tagToAdd])]
      });
    } catch (error) {
      console.error('Error adding new tag:', error);
    }
  }

  // Safe date formatting function
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const formatSpeakerTranscripts = () => {
    if (!meeting.speakerTranscript || !Array.isArray(meeting.speakerTranscript)) return '';

    const transcripts = meeting.speakerTranscript
      .sort((a, b) => a.start - b.start)
      .map(entry => {
        const time = formatTranscriptTime(entry.start);
        return `**${time} - ${entry.speaker}:** ${entry.text.trim()}`;
      })
      .join('\n\n');

    return transcripts;
  };

  const formatNotes = () => {
    const sections = [];

    // Add timestamp
    const meetingDate = new Date(meeting.timestamp).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    sections.push(`## Meeting Time: ${meetingDate}\n`);

    // Add notes if they exist
    if (meeting.notes) {
      sections.push('## Notes\n');
      sections.push(`${meeting.notes.trim()}\n\n`);
    }

    // Transcript section is intentionally omitted since there's already a dedicated transcription tab
    
    return sections.join('');
  };

  const uniqueSpeakers = new Set(
    meeting.speakerTranscript.map(t => t.speaker)
  );

  const handleCopyNotes = async () => {
    const notesText = formatNotes();
    try {
      await navigator.clipboard.writeText(notesText);
      setCopied(true);
      toast({
        title: "Notes copied",
        description: "Meeting notes have been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy notes to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMeeting = async () => {
    if (!user?.email) return;
    
    try {
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await deleteDoc(meetingRef);
      
      toast({
        title: "Meeting deleted",
        description: "The meeting has been successfully deleted.",
      });
      
      if (onDelete) {
        onDelete();
      }
      onClose();
    } catch (err) {
      console.error('Error deleting meeting:', err);
      toast({
        title: "Failed to delete",
        description: "Could not delete the meeting. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add function to handle speaker name update
  const handleUpdateSpeakerName = async (oldName: string, newName: string) => {
    if (!user?.email || !newName.trim()) return;

    try {
      // Create a new speakerTranscript object with updated names
      const updatedSpeakerTranscript = meeting.speakerTranscript.map(entry => 
        entry.speaker === oldName ? { ...entry, speaker: newName } : entry
      );

      // Update the document in Firestore
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        speakerTranscript: updatedSpeakerTranscript
      });

      // Show success message
      toast({
        title: "Speaker name updated",
        description: `Changed speaker name from "${oldName}" to "${newName}"`,
      });

      // Update local state
      meeting.speakerTranscript = updatedSpeakerTranscript;
      setEditingSpeaker(null);
      setNewSpeakerName("");
    } catch (error) {
      console.error('Error updating speaker name:', error);
      toast({
        title: "Error updating speaker name",
        description: "Failed to update the speaker name. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add function to update notes
  const handleUpdateNotes = async (newNotes: string) => {
    if (!user?.email) return;

    try {
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        notes: newNotes
      });

      // Update local state
      meeting.notes = newNotes;

      toast({
        title: "Notes updated",
        description: "The meeting notes have been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating notes:', error);
      toast({
        title: "Failed to update notes",
        description: "Could not update the meeting notes. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add function to update transcript
  const handleUpdateTranscript = async (newTranscript: string) => {
    if (!user?.email) return;

    try {
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        transcript: newTranscript
      });

      // Update local state
      meeting.transcript = newTranscript;

      toast({
        title: "Transcript updated",
        description: "The meeting transcript has been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating transcript:', error);
      toast({
        title: "Failed to update transcript",
        description: "Could not update the meeting transcript. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to be caught by the EditableContent component
    }
  };

  const handleToggleActionItem = async (actionItem: ActionItem) => {
    if (!user?.email) return;
    
    try {
      // Update local state immediately to improve responsiveness
      const updatedActionItems = meeting.actionItems.map(item => 
        item.id === actionItem.id ? { ...item, done: !item.done } : item
      );
      meeting.actionItems = updatedActionItems;
      
      // Then update Firestore in the background
      const actionItemRef = doc(getFirebaseDb(), 'transcript', user.email, 'actionItems', actionItem.id);
      await updateDoc(actionItemRef, {
        done: !actionItem.done
      });
      
      toast({
        title: actionItem.done ? "Action item uncompleted" : "Action item completed",
        description: actionItem.title,
      });
    } catch (error) {
      console.error('Error updating action item:', error);
      // Revert the local state change if the update failed
      const revertedActionItems = meeting.actionItems.map(item => 
        item.id === actionItem.id ? { ...item, done: actionItem.done } : item
      );
      meeting.actionItems = revertedActionItems;
      
      toast({
        title: "Error updating action item",
        description: "Failed to update the action item status",
        variant: "destructive",
      });
    }
  };

  // Debounced action item update (to avoid rapid Firebase updates during typing)
  const debouncedUpdateActionItem = useCallback(
    debounce(async (itemId: string, field: 'title' | 'description', value: string) => {
      if (!user?.email) return;
      
      try {
        const actionItemRef = doc(getFirebaseDb(), 'transcript', user.email, 'actionItems', itemId);
        await updateDoc(actionItemRef, {
          [field]: value
        });
      } catch (error) {
        console.error(`Error updating action item ${field}:`, error);
      }
    }, 800), // 800ms debounce to reduce typing issues
    [user?.email]
  );

  // Handle action item title/description changes
  const handleActionItemChange = (actionItem: ActionItem, field: 'title' | 'description', value: string) => {
    // Update local state immediately
    const updatedActionItems = meeting.actionItems.map(item => 
      item.id === actionItem.id ? { ...item, [field]: value } : item
    );
    meeting.actionItems = updatedActionItems;
    
    // Debounce the Firestore update
    debouncedUpdateActionItem(actionItem.id, field, value);
  };

  const handleCreateActionItem = async (title: string, description: string) => {
    if (!user?.email) return;
    
    const timestamp = Date.now();
    const newItemId = `manual-${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
    
    const newActionItem: ActionItem = {
      id: newItemId,
      title,
      description,
      done: false
    };
    
    // Update local state immediately for better UX
    const updatedActionItems = [...meeting.actionItems, newActionItem];
    setMeeting({ ...meeting, actionItems: updatedActionItems });
    
    try {
      // Update Firestore
      const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
      await updateDoc(meetingRef, {
        actionItems: updatedActionItems
      });
      
      toast({
        title: "Action item added",
        description: "New action item created successfully",
      });
    } catch (error) {
      console.error('Error adding action item:', error);
      // Remove from local state if Firestore update failed
      setMeeting({ ...meeting, actionItems: meeting.actionItems });
      
      toast({
        title: "Error adding action item",
        description: "Failed to create new action item",
        variant: "destructive",
      });
    }
  };

  // Function to sync meeting data with Attio contacts
  const syncWithAttio = async () => {
    if (!user?.email) return;
    
    setIsSyncingAttio(true);
    setAttioSyncStatus('none');
    
    try {
      const response = await fetch('/api/attio/sync-meeting', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.email}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ meetingId: meeting.id })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.needsConnection) {
          setAttioSyncStatus('not-connected');
          setShowAttioConnectDialog(true);
          return;
        }
        
        throw new Error(data.error || 'Failed to sync with Attio');
      }
      
      setAttioSyncStatus('success');
      toast({
        title: "Synced with Attio",
        description: data.message || `Meeting data synced with Attio successfully.`,
      });
    } catch (error) {
      console.error('Error syncing with Attio:', error);
      setAttioSyncStatus('error');
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync meeting data with Attio",
        variant: "destructive",
      });
    } finally {
      setIsSyncingAttio(false);
    }
  };

  // Function to redirect to Attio connect
  const connectToAttio = async () => {
    if (!user?.email) return;
    
    try {
      const response = await fetch('/api/attio/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get Attio auth URL');
      }
      
      const { url } = await response.json();
      
      // Store current location to return after auth
      localStorage.setItem('attioReturnUrl', window.location.href);
      
      // Redirect to Attio auth
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting to Attio:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Attio. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add logging effect for meeting data
  useEffect(() => {
    console.log('=== Meeting Data Debug ===');
    console.log('Meeting ID:', meeting.id);
    console.log('Audio URL:', meeting.audioURL);
    console.log('Speaker Transcript:', meeting.speakerTranscript);
    console.log('Speaker Transcript Type:', typeof meeting.speakerTranscript);
    console.log('Audio Element State:', {
      audioElement: !!audioElement,
      isPlaying,
      currentTime,
      duration
    });
    
    if (meeting.speakerTranscript) {
      console.log('Speaker Transcript Array Check:', Array.isArray(meeting.speakerTranscript));
      console.log('Speaker Transcript Length:', meeting.speakerTranscript.length);
      if (meeting.speakerTranscript.length > 0) {
        console.log('First Entry Sample:', meeting.speakerTranscript[0]);
      }
    }
  }, [meeting, audioElement, isPlaying, currentTime, duration]);

  // Add logging for audio initialization
  useEffect(() => {
    console.log('=== Audio Player Initialization ===');
    console.log('Audio URL:', meeting.audioURL);
    
    if (meeting.audioURL) {
      const audio = new Audio(meeting.audioURL);
      
      audio.addEventListener('loadedmetadata', () => {
        console.log('Audio metadata loaded:', {
          duration: audio.duration,
          readyState: audio.readyState
        });
        setDuration(audio.duration);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio loading error:', {
          error: e,
          audioError: audio.error,
          audioURL: meeting.audioURL
        });
      });

      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });

      audio.addEventListener('play', () => {
        console.log('Audio playback started');
        setIsPlaying(true);
      });

      audio.addEventListener('pause', () => {
        console.log('Audio playback paused');
        setIsPlaying(false);
      });

      setAudioElement(audio);

      return () => {
        console.log('Cleaning up audio element');
        audio.pause();
        audio.remove();
      };
    } else {
      console.warn('No audio URL provided for meeting:', meeting.id);
    }
  }, [meeting.audioURL, meeting.id]);

  // Format time for audio player
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle audio playback
  const togglePlayPause = () => {
    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
    }
  };

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioElement) {
      const time = parseFloat(e.target.value);
      audioElement.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Format time for transcript display
  const formatTranscriptTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <motion.div
        className="bg-white dark:bg-slate-900 shadow-xl z-50 overflow-y-auto w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Header with Action Buttons */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} className="mr-2 flex items-center gap-1 rounded-full">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h2 className="text-xl font-semibold truncate">{meeting.title || meeting.name}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={handleCopyNotes}
              className="flex items-center gap-2 rounded-full"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Notes</span>
                </>
              )}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDeleteMeeting} className="text-destructive">
                  Delete Meeting
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex h-[calc(100vh-64px)] overflow-hidden">
          {/* Main Content Column */}
          <div className="flex flex-col h-full w-3/4 overflow-hidden">
            {/* Header Section - Fixed height */}
            <div className="flex-none p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{meeting.emoji}</span>
                  <h2 className="text-2xl font-bold">{meeting.title}</h2>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <Badge variant="secondary">
                  <Calendar className="w-4 h-4 mr-1" />
                  {formatDate(meeting.timestamp)}
                </Badge>
                <Badge variant="secondary">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatDate(meeting.timestamp)}
                </Badge>
                <Badge variant="secondary">
                  <Users className="w-4 h-4 mr-1" />
                  {uniqueSpeakers.size} participants
                </Badge>
                {meeting.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
                <Button variant="outline" size="sm" onClick={() => setShowTagSelector(true)} className="rounded-full">
                  Add Tag
                </Button>
              </div>

              {/* Tag Selector */}
              {showTagSelector && (
                <div className="mt-4 p-4 border rounded-lg bg-background">
                  <h3 className="font-medium mb-4">Add Tags</h3>
                  
                  {/* Available tags section - moved to top */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-3">Choose from existing tags</h4>
                    <div className="flex flex-wrap gap-2 border rounded-lg p-3 bg-muted/30">
                      {allTags
                        .filter(tag => !selectedTags.includes(tag))
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors py-1 px-3"
                            onClick={() => setSelectedTags(prev => [...prev, tag])}
                          >
                            + {tag}
                          </Badge>
                        ))}
                      {allTags.filter(tag => !selectedTags.includes(tag)).length === 0 && (
                        <p className="text-sm text-muted-foreground">No more tags available</p>
                      )}
                    </div>
                  </div>

                  {/* Create new tag section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-3">Or create a new tag</h4>
                    <form onSubmit={handleAddTag} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Type new tag name..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" size="sm" disabled={!newTag.trim()}>
                        Create
                      </Button>
                    </form>
                  </div>

                  {/* Selected tags section */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium mb-3">Selected tags</h4>
                    <div className="flex flex-wrap gap-2 border rounded-lg p-3 bg-muted/30">
                      {selectedTags.length > 0 ? (
                        selectedTags.map((tag) => (
                          <Badge 
                            key={tag} 
                            variant="secondary"
                            className="flex items-center gap-1 py-1 px-3 rounded-full"
                          >
                            {tag}
                            <button
                              onClick={() => setSelectedTags(tags => tags.filter(t => t !== tag))}
                              className="ml-1 hover:text-destructive focus:outline-none"
                              aria-label="Remove tag"
                            >
                              ×
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tags selected</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" onClick={handleSaveTags} className="rounded-full">Save Changes</Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setShowTagSelector(false);
                        setSelectedTags(meeting.tags);
                      }}
                      className="rounded-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Items Section */}
            <div className="flex-none p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Action Items</h3>
                <Button onClick={() => setShowCreateActionItem(true)} variant="outline" size="sm" className="rounded-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Action Item
                </Button>
              </div>
              <div className="space-y-2">
                {meeting.actionItems?.length > 0 ? (
                  meeting.actionItems.map((item) => (
                    <div key={item.id} className="flex items-start space-x-2 p-2 rounded-lg hover:bg-accent/5">
                      <Checkbox 
                        checked={item.done} 
                        onCheckedChange={async () => {
                          if (!user?.email) return;
                          try {
                            const updatedActionItems = meeting.actionItems.map(ai => 
                              ai.id === item.id ? { ...ai, done: !ai.done } : ai
                            );
                            
                            // Update in Firestore
                            const meetingRef = doc(getFirebaseDb(), 'transcript', user.email, 'timestamps', meeting.id);
                            await updateDoc(meetingRef, {
                              actionItems: updatedActionItems
                            });
                            
                            // Update local state
                            setMeeting({ ...meeting, actionItems: updatedActionItems });
                            
                            toast({
                              title: item.done ? "Action item uncompleted" : "Action item completed",
                              description: item.title,
                            });
                          } catch (error) {
                            console.error('Error updating action item:', error);
                            toast({
                              title: "Error updating action item",
                              description: "Failed to update the action item status",
                              variant: "destructive",
                            });
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className={cn(
                          "text-sm font-medium",
                          item.done && "line-through text-muted-foreground"
                        )}>
                          {item.title}
                        </p>
                        {item.description && (
                          <p className={cn(
                            "text-sm text-muted-foreground mt-1",
                            item.done && "line-through"
                          )}>
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No action items for this meeting.
                  </p>
                )}
              </div>
            </div>

            {/* Main Content - Fill remaining height */}
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="playback" className="h-full flex flex-col">
                <TabsList className="mx-6 mt-2">
                  <TabsTrigger value="playback">Playback</TabsTrigger>
                  <TabsTrigger value="summaries">Summaries</TabsTrigger>
                </TabsList>

                <TabsContent value="playback" className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-8">
                    {/* Audio Player Section */}
                    {meeting.audioURL && (
                      <div className="p-4 bg-card rounded-lg border">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={togglePlayPause}
                              className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
                            >
                              {isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                  <rect x="6" y="4" width="4" height="16"/>
                                  <rect x="14" y="4" width="4" height="16"/>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 ml-0.5">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                              )}
                            </button>
                            <div className="flex-1">
                              <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime || 0}
                                onChange={handleSeek}
                                className="w-full"
                              />
                            </div>
                            <div className="text-sm tabular-nums">
                              {formatTime(currentTime || 0)} / {formatTime(duration || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Transcript Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Transcript</h3>
                      <div className="space-y-4">
                        {meeting.speakerTranscript && meeting.speakerTranscript.length > 0 ? (
                          meeting.speakerTranscript
                            .sort((a, b) => (a.start || 0) - (b.start || 0))
                            .map((entry, index) => (
                              <div key={`${entry.speaker}-${entry.start}-${index}`} className="p-4 rounded-lg border bg-card hover:bg-accent/50">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium">{entry.speaker}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {formatTranscriptTime(entry.start)}
                                      </span>
                                    </div>
                                    <p className="text-sm">{entry.text}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            No transcript available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="summaries" className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-8">
                    {/* Notes Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Notes</h3>
                        <Button variant="outline" size="sm" onClick={handleCopyNotes} className="rounded-full">
                          Copy Notes
                        </Button>
                      </div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedNotes}
                            onChange={(e) => setEditedNotes(e.target.value)}
                            className="min-h-[400px] font-mono text-sm"
                            placeholder="No notes available"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditing(false);
                                setEditedNotes(meeting.notes);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                await handleUpdateNotes(editedNotes);
                                setIsEditing(false);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 bg-card">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {meeting.notes || 'No notes available'}
                            </ReactMarkdown>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 rounded-full"
                            onClick={() => {
                              setIsEditing(true);
                              setEditedNotes(meeting.notes);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* AI Assistant Column - Fixed width */}
          <div className="w-1/4 h-full flex flex-col border-l bg-muted/10 relative overflow-hidden">
            <div className="p-3 border-b bg-background flex items-center gap-2 flex-none">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-medium">Meeting Assistant</h3>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIChat 
                meetingNotes={meeting.notes || meeting.transcript || ''} 
                onEditNotes={handleUpdateNotes}
              />
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Attio Connect Dialog */}
      <AlertDialog open={showAttioConnectDialog} onOpenChange={setShowAttioConnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Connect to Attio</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                To sync your meeting data with Attio, you need to connect your account first.
              </p>
              <p>
                Attio helps you manage your contacts and relationships by automatically updating your CRM with meeting information.
              </p>
              <p className="font-medium">
                Would you like to connect now?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-0">
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={connectToAttio} className="bg-blue-600 hover:bg-blue-700 rounded-full">
              Connect to Attio
            </AlertDialogAction>
            <Button 
              variant="outline" 
              onClick={() => {
                window.location.href = '/dashboard/settings?tab=account';
                setShowAttioConnectDialog(false);
              }}
              className="rounded-full"
            >
              Go to Integrations Settings
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateActionItemDialog
        open={showCreateActionItem}
        onOpenChange={setShowCreateActionItem}
        onSubmit={handleCreateActionItem}
      />
    </>
  );
} 