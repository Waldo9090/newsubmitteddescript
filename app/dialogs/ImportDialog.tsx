'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useRef } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp, writeBatch, collection } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { useMeetings } from '@/src/context/meetings-context';
import { processLatestTranscriptInsights } from '@/lib/insights-listener';
import { exportToNotion } from '@/lib/notion-export';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const { user } = useAuth();
  const { refreshMeetings } = useMeetings();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-primary');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-primary');
    }
  };

  const processAudioFile = async (file: File) => {
    if (!user?.email) {
      console.error('No user email found');
      setProcessingStatus('Error: Please sign in to save recordings');
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Uploading audio...');

    try {
      // Upload to Firebase Storage
      const storage = getStorage();
      const audioRef = ref(storage, `audio/${user.email}/${Date.now()}_${file.name}`);
      await uploadBytes(audioRef, file);
      const audioURL = await getDownloadURL(audioRef);

      // Get transcription using AssemblyAI
      setProcessingStatus('Transcribing audio...');
      console.log('Sending audio for transcription:', { audioURL });
      
      // Step 1: Transcribe audio
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          audioURL,
          language_code: "en",
          speaker_labels: true
        })
      });

      if (!transcribeResponse.ok) {
        throw new Error(`Transcription failed with status ${transcribeResponse.status}`);
      }

      const responseData = await transcribeResponse.json();
      
      if (responseData.error) {
        throw new Error(`Transcription service error: ${responseData.error}`);
      }

      const transcriptText = responseData.transcript || '';
      const speakerTranscriptData = responseData.speakerTranscript || [];

      // Step 2: Generate summary
      setProcessingStatus('Generating summary...');
      const fullTranscript = transcriptText;

      if (!fullTranscript.trim()) {
        throw new Error('Empty transcript received');
      }

      console.log('=== Generating Meeting Summary (Import) ===');
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
            transcript: fullTranscript
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
          const timestamp = Date.now();
          const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
          
          console.log('=== Saving Meeting Document ===');
          console.log('Creating document with path:', `transcript/${user.email}/timestamps/${uniqueId}`);
          
          const meetingData = {
            audioURL,
            emoji: meetingEmoji || '📝',
            id: uniqueId,
            name: meetingName || 'New Meeting',
            notes: meetingNotes || '',
            speakerTranscript: speakerTranscriptData,
            tags: ['meeting'],
            timestamp: serverTimestamp(),
            timestampMs: Date.now(),
            title: meetingName || 'New Meeting',
            transcript: fullTranscript,
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

          // Export to Notion if integration exists
          console.log('=== Starting Notion Export ===');
          await exportToNotion(user.email);
          console.log('=== Notion Export Complete ===');

          // Process insights for the newly added transcript
          console.log('=== Starting Automation Processing ===');
          console.log('User:', user.email);
          console.log('Meeting ID:', uniqueId);
          console.log('Meeting Name:', meetingName || 'New Meeting');
          console.log('Transcript Length:', fullTranscript.length);
          
          setProcessingStatus('Processing automations...');
          await exportToNotion(user.email);

          console.log('=== Automation Processing Complete ===');

          await refreshMeetings();
          setProcessingStatus('Meeting saved successfully!');
          setIsProcessing(false);
          onOpenChange(false);
        } catch (error) {
          console.error('Error saving meeting and action items:', error);
          setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Failed to save meeting and action items'));
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Error generating summary:', error);
        setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Failed to generate summary'));
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Failed to process audio'));
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-primary');
    }

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      await processAudioFile(file);
    } else {
      alert('Please upload an audio file');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processAudioFile(file);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Recording</DialogTitle>
          <DialogDescription>
            Upload an existing meeting recording to transcribe.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div
            ref={dropZoneRef}
            className="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-primary"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleFileSelect}
            />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Drag and drop your audio file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Supports MP3, WAV, M4A, and other audio formats
            </p>
          </div>
          {isProcessing && (
            <div className="text-center py-4">
              <div className="animate-pulse text-blue-600 font-medium">{processingStatus}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}