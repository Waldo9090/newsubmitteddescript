'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from '@/context/auth-context';
import { collection, addDoc, writeBatch, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import {
  createBot,
  getBotStatus,
  leaveBot,
  getBotRecording,
  getBotTranscript
} from '@/lib/attendee';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { exportToNotion } from '@/lib/notion-export';

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TranscriptUtterance {
  speaker_name: string;
  speaker_uuid: string;
  speaker_user_uuid: string | null;
  timestamp_ms: number;
  duration_ms: number;
  transcription: null | string | { transcript: string };
}

interface SpeakerTranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
  duration: number;
}

interface GeneratedActionItem {
  title: string;
  description: string;
}

interface ActionItem {
  title: string;
  description: string;
}

interface MeetingActionItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  meeting: {
    id: string;
    name: string;
  };
}

export default function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const { user } = useAuth();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    let statusInterval: NodeJS.Timeout;
    let hasStartedProcessing = false;

    if (botId) {
      const checkStatus = async () => {
        try {
          console.log('Checking bot status for:', botId);
          const status = await getBotStatus(botId);
          console.log('Received bot status:', status);
          
          setBotStatus(status.state);
          setRecordingStatus(status.recording_state || null);
          setTranscriptionStatus(status.transcription_state || null);

          if (status.state === 'ended' && 
              status.recording_state === 'complete' && 
              status.transcription_state === 'complete' &&
              !hasStartedProcessing &&
              !loading) {
            console.log('Bot has completed recording and transcription, processing...');
            hasStartedProcessing = true;
            await processRecording();
          }
        } catch (error) {
          console.error('Error checking bot status:', error);
          setError('Failed to check bot status: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      };

      statusInterval = setInterval(checkStatus, 5000);
      checkStatus();
    }

    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [botId, loading]);

  const processRecording = async () => {
    if (!botId || !user?.email) return;

    setLoading(true);
    setBotStatus('processing_recording');
    try {
      console.log('Starting recording processing for bot:', botId);

      // Get recording URL
      const recording = await getBotRecording(botId);
      if (!recording || !recording.url) {
        throw new Error('No recording URL available');
      }

      // Get transcript with retries
      let transcriptData: TranscriptUtterance[] | null = null;
      let attempts = 0;
      const maxAttempts = 5;
      const retryDelay = 3000; // 3 seconds

      while (attempts < maxAttempts) {
        setProcessingStatus(`Fetching transcript (Attempt ${attempts + 1}/${maxAttempts})...`);
        transcriptData = await getBotTranscript(botId);
        console.log(`Transcript attempt ${attempts + 1}:`, {
          hasData: !!transcriptData,
          length: transcriptData?.length || 0,
          data: JSON.stringify(transcriptData, null, 2)
        });

        if (transcriptData && transcriptData.length > 0) {
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setProcessingStatus(
            `Waiting ${retryDelay / 1000}s before retry ${attempts + 1}/${maxAttempts}...`
          );
          console.log(`Waiting ${retryDelay}ms before retry ${attempts + 1}/${maxAttempts}`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      if (!transcriptData || transcriptData.length === 0) {
        throw new Error(
          'No transcript data available after multiple attempts. Please try again in a few moments.'
        );
      }

      console.log('Retrieved recording and transcript:', {
        url: recording.url,
        startTimestamp: recording.start_timestamp_ms,
        utteranceCount: transcriptData.length
      });

      // Log the entire transcript data
      console.log('Full transcript data from Attendee API:', JSON.stringify(transcriptData, null, 2));

      // Build a structured speakerTranscript array
      const speakerTranscript: SpeakerTranscriptEntry[] = (transcriptData || []).map((utt) => {
        let text = '';
        if (utt.transcription && typeof utt.transcription === 'object') {
          text = utt.transcription.transcript || '';
        } else if (typeof utt.transcription === 'string') {
          text = utt.transcription;
        }

        return {
          speaker: utt.speaker_name,
          text,
          timestamp: utt.timestamp_ms,
          duration: utt.duration_ms
        };
      });

      // Create a single combined transcript string
      const transcript = speakerTranscript.map((st) => st.text).join(' ').trim();

      console.log('Transcript formatted:', {
        transcriptLength: transcript.length,
        speakerCount: speakerTranscript.length
      });

      // Generate unique ID
      const timestamp = Date.now();
      const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;

      // Generate summary
      setProcessingStatus('Generating summary...');
      const fullTranscript = transcript;

      if (!fullTranscript.trim()) {
        throw new Error('Empty transcript received');
      }

      console.log('=== Generating Meeting Summary (Invite) ===');
      console.log('Transcript length:', fullTranscript.length);

      try {
        const summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            transcript: fullTranscript
          })
        });

        if (!summaryResponse.ok) {
          const summaryResponseText = await summaryResponse.text();
          console.error('Summary generation failed:', {
            status: summaryResponse.status,
            response: summaryResponseText
          });
          throw new Error(`Summary generation failed with status ${summaryResponse.status}: ${summaryResponseText}`);
        }

        const summaryData = await summaryResponse.json();
        console.log('Summary generation successful:', {
          hasName: !!summaryData.name,
          hasEmoji: !!summaryData.emoji,
          notesLength: summaryData.notes?.length || 0,
          actionItemsCount: summaryData.actionItems?.length || 0
        });

        const { 
          emoji: meetingEmoji, 
          name: meetingName, 
          notes: meetingNotes, 
          actionItems: generatedActionItems 
        } = summaryData;

        if (!meetingName || !meetingEmoji || !meetingNotes) {
          console.error('Missing required fields in summary response:', {
            hasName: !!meetingName,
            hasEmoji: !!meetingEmoji,
            hasNotes: !!meetingNotes
          });
        }

        // Extract action items from transcript
        setProcessingStatus('Extracting action items...');
        const actionItemsResponse = await fetch('/api/extract-action-items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            transcript
          })
        });

        let extractedActionItems = [];
        if (actionItemsResponse.ok) {
          const actionItemsData = await actionItemsResponse.json();
          console.log('Extracted action items:', actionItemsData);
          extractedActionItems = actionItemsData.actionItems || [];
        } else {
          console.error('Failed to extract action items:', await actionItemsResponse.text());
        }

        // Save to Firestore
        setProcessingStatus('Saving meeting data...');
        try {
          const db = getFirebaseDb();
          const batch = writeBatch(db);
          
          // Save meeting document with only specified fields
          console.log('=== Saving Meeting Document ===');
          console.log('Creating document with path:', `transcript/${user.email}/timestamps/${uniqueId}`);
          
          const meetingData = {
            audioURL: recording.url,
            emoji: meetingEmoji || '📝',
            id: uniqueId,
            name: meetingName || 'New Meeting',
            notes: meetingNotes || '',
            speakerTranscript,
            tags: ['meeting'],
            timestamp: serverTimestamp(),
            timestampMs: Date.now(),
            title: meetingName || 'New Meeting',
            transcript,
            type: 'recording',
            actionItems: extractedActionItems.map((item: ActionItem) => ({
              id: `${uniqueId}-${Math.random().toString(36).substring(2, 15)}`,
              title: item.title,
              description: item.description,
              done: false
            }))
          };
          console.log('Meeting Document:', meetingData);

          const meetingsCollection = collection(db, 'transcript', user.email, 'timestamps');
          const meetingRef = doc(meetingsCollection, uniqueId);
          console.log('Using meetingRef:', meetingRef.path);
          
          try {
            await batch.set(meetingRef, meetingData);
            console.log('Meeting document added to batch successfully');
          } catch (error) {
            console.error('Error adding meeting document to batch:', error);
            throw error;
          }

          // Save action items
          if (extractedActionItems.length > 0) {
            setProcessingStatus('Saving action items...');
            console.log('=== Processing Action Items ===');
            console.log(`Found ${extractedActionItems.length} action items to process`);
            
            // First commit the main meeting document batch to reduce transaction size
            try {
              console.log('Committing main meeting document batch to Firestore...');
              await batch.commit();
              console.log('Main document batch committed successfully');
            } catch (error) {
              console.error('Error committing main document batch to Firestore:', error);
              throw error;
            }
            
            // Now save each action item individually instead of in a batch
            console.log('Saving action items individually...');
            const actionItemsCollection = collection(db, 'transcript', user.email, 'actionItems');
            let savedCount = 0;
            
            for (const item of extractedActionItems) {
              try {
                const actionItemId = `${uniqueId}-${Math.random().toString(36).substring(2, 15)}`;
                const actionItemRef = doc(actionItemsCollection, actionItemId);
                
                // Create action item with required fields
                const actionItemData = {
                  id: actionItemId,
                  title: item.title,
                  description: item.description,
                  done: false,
                  meeting: {
                    id: uniqueId,
                    name: meetingName || 'New Meeting'
                  },
                  timestamp: serverTimestamp()
                };

                console.log(`Saving Action Item ${savedCount + 1}:`, actionItemData);
                await setDoc(actionItemRef, actionItemData);
                savedCount++;
              } catch (itemError) {
                console.error(`Error saving action item: ${itemError}`);
                // Continue saving other items if possible
              }
            }
            
            console.log('=== Action Items Saved Successfully ===');
            console.log(`Total action items saved: ${savedCount} of ${extractedActionItems.length}`);
          } else {
            // If no action items, just commit the main document batch
            try {
              console.log('Committing batch to Firestore...');
              await batch.commit();
              console.log('Batch committed successfully');
            } catch (error) {
              console.error('Error committing batch to Firestore:', error);
              throw error;
            }
          }
          
          console.log('=== Meeting Document Saved Successfully ===');

          // Add detailed information about document location
          console.log(`DOCUMENT LOCATION: /transcript/${user.email}/timestamps/${uniqueId}`);
          console.log(`USER EMAIL: ${user.email}`);
          console.log(`DOCUMENT ID: ${uniqueId}`);
          console.log(`FULL PATH: firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/transcript/${user.email}/timestamps/${uniqueId}`);

          // Process automations
          console.log('=== Starting Automation Processing ===');
          console.log('User:', user.email);
          console.log('Meeting ID:', uniqueId);
          console.log('Meeting Name:', meetingName || 'New Meeting');

          setProcessingStatus('Processing automations...');
          await exportToNotion(user.email);

          console.log('=== Automation Processing Complete ===');

          toast({
            title: 'Meeting recorded successfully',
            description: 'The recording has been saved to your library.',
          });

          onOpenChange(false);
        } catch (error: any) {
          console.error('Error saving to Firestore:', error);
          throw new Error(`Failed to save meeting data: ${error.message}`);
        }
      } catch (error: any) {
        console.error('Error generating summary:', error);
        setError(error.message);
        toast({
          title: 'Error generating summary',
          description: error.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error processing recording:', error);
      setError(error.message);
      toast({
        title: 'Error processing recording',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setBotId(null);
      setBotStatus(null);
    }
  };

  const handleJoinMeeting = async () => {
    if (!meetingUrl) {
      setError('Please enter a meeting URL');
      return;
    }

    if (!user?.email) {
      setError('Please sign in to join a meeting');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Creating bot for meeting:', meetingUrl);
      const bot = await createBot(meetingUrl);
      console.log('Bot created:', bot);
      
      setBotId(bot.id);
      setBotStatus(bot.state);
      toast({
        title: 'Bot joined meeting',
        description: 'The bot will record and transcribe the meeting.',
      });
    } catch (error) {
      console.error('Error joining meeting:', error);
      setError('Failed to join meeting: ' + (error instanceof Error ? error.message : 'Please check the URL and try again'));
      toast({
        title: 'Failed to join meeting',
        description: error instanceof Error ? error.message : 'Please check the URL and try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (botId && botStatus === 'joined') {
      try {
        await leaveBot(botId);
        toast({
          title: 'Bot left meeting',
          description: 'The recording will be processed shortly.',
        });
      } catch (error) {
        console.error('Error leaving meeting:', error);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Descript AI to Meeting</DialogTitle>
          <DialogDescription>
            Enter the meeting URL to have Descript AI join and record your meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="meetingUrl">Meeting URL</Label>
            <Input
              id="meetingUrl"
              placeholder="https://zoom.us/j/..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              disabled={loading || !!botId}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {botId && (
            <div className="space-y-2 bg-gray-50 p-3 rounded">
              <div className="text-sm font-medium">Bot Status</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Connection:</div>
                <div className={`font-medium ${
                  botStatus === 'joined' ? 'text-green-600' : 
                  botStatus === 'left' ? 'text-yellow-600' : 
                  'text-blue-600'
                }`}>
                  {botStatus || 'Connecting...'}
                </div>
                
                {recordingStatus && (
                  <>
                    <div className="text-muted-foreground">Recording:</div>
                    <div className={`font-medium ${
                      recordingStatus === 'recording' ? 'text-red-600' : 
                      recordingStatus === 'complete' ? 'text-green-600' : 
                      'text-blue-600'
                    }`}>
                      {recordingStatus}
                    </div>
                  </>
                )}
                
                {transcriptionStatus && (
                  <>
                    <div className="text-muted-foreground">Transcription:</div>
                    <div className={`font-medium ${
                      transcriptionStatus === 'complete' ? 'text-green-600' : 
                      'text-blue-600'
                    }`}>
                      {transcriptionStatus}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleJoinMeeting} 
              disabled={loading || !meetingUrl || !!botId}
            >
              {loading ? 'Connecting...' : 'Join Meeting'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}