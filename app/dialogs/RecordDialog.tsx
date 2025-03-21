'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Square, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, collection, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useMeetings } from '@/src/context/meetings-context';
import { processLatestTranscriptInsights } from '@/lib/insights-listener';
import { exportToNotion } from '@/lib/notion-export';
import { storage } from '@/lib/firebase';

interface RecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSEMBLY_AI_API_KEY = process.env.NEXT_PUBLIC_ASSEMBLY_AI_API_KEY;

if (!ASSEMBLY_AI_API_KEY) {
  throw new Error('Missing AssemblyAI API key in environment variables');
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

export default function RecordDialog({ open, onOpenChange }: RecordDialogProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { refreshMeetings } = useMeetings();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<typeof WaveSurfer | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const recordingStartTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  // Handle authentication state
  useEffect(() => {
    if (!loading && !user) {
      console.log('No user found, redirecting to sign in...');
      onOpenChange(false);
      router.push('/login');
    }
  }, [user, loading, router, onOpenChange]);

  // Initialize WaveSurfer for visualization
  useEffect(() => {
    if (waveformRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4f46e5',
        progressColor: '#818cf8',
        cursorWidth: 0,
        height: 100,
        normalize: true,
        barWidth: 2,
        barGap: 3,
        interact: false,
        backend: 'WebAudio',
      });
    }
    return () => {
      wavesurferRef.current?.destroy();
    }
  }, []);

  // Update recording timer
  useEffect(() => {
    if (isRecording) {
      recordingStartTimeRef.current = Date.now();
      const updateTimer = () => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
        setRecordingTime(elapsed);
        animationFrameRef.current = requestAnimationFrame(updateTimer);
      };
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isRecording]);

  // Start recording using microphone and initiate waveform animation
  const startRecording = async () => {
    if (!user?.email) {
      console.log('No user email found, redirecting to login...');
      router.push('/login');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray);
          // Compute average volume level
          const avg = dataArray.reduce((acc, cur) => acc + cur, 0) / bufferLength;
          // Update wavesurfer visualization
          if (wavesurferRef.current) {
            const progress = Math.min(avg / 255, 1);
            wavesurferRef.current.drawer.progress(progress);
          }
          requestAnimationFrame(updateWaveform);
        }
      };

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      // Start visualization
      updateWaveform();

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          wavesurferRef.current?.load(url);
          // Process the recorded audio
          await processAudio(blob);
        } catch (error) {
          console.error('Failed to process recording:', error);
          setProcessingStatus('Recording failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
          setIsProcessing(false);
        }
      };

      setMediaRecorder(recorder);
      recorder.start(1000); // Request data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  // Stop recording and finalize audio capture
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      audioStream?.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // Process the recorded audio: upload, transcribe, diarize speakers, and generate summary via GPT API
  const processAudio = async (audioBlob: Blob) => {
    if (!user?.email) {
      console.error('No user email found');
      setProcessingStatus('Error: Please sign in to save recordings');
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Uploading audio...');
    try {
      // Upload to Firebase Storage using email in path
      const storage = getStorage();
      const audioRef = ref(storage, `audio/${user.email}/${Date.now()}.m4a`);
      await uploadBytes(audioRef, audioBlob);
      const audioURL = await getDownloadURL(audioRef);

      // Get transcription using AssemblyAI
      setProcessingStatus('Transcribing audio...');
      console.log('Sending audio for transcription:', { audioURL });
      
      let transcriptText = '';
      let speakerTranscriptData = [];
      let summaryResponse;

      try {
        // Step 1: Transcribe audio
        console.log('Making transcription request to:', '/api/transcribe');
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

        console.log('Transcribe API response status:', transcribeResponse.status);
        console.log('Transcribe API response headers:', Object.fromEntries(transcribeResponse.headers.entries()));
        
        const responseText = await transcribeResponse.text();
        console.log('Raw response:', responseText);

        if (!transcribeResponse.ok) {
          throw new Error(`Transcription failed with status ${transcribeResponse.status}: ${responseText}`);
        }

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response as JSON:', e);
          throw new Error('Invalid JSON response from transcription service');
        }

        console.log('Parsed transcription response:', responseData);
        
        // Check for error in response
        if (responseData.error) {
          throw new Error(`Transcription service error: ${responseData.error}`);
        }
        
        // Validate transcript data
        if (!responseData.transcript && (!responseData.speakerTranscript || responseData.speakerTranscript.length === 0)) {
          console.error('Invalid transcript data:', responseData);
          throw new Error('No valid transcript data received from transcription service');
        }

        transcriptText = responseData.transcript || '';
        speakerTranscriptData = responseData.speakerTranscript || [];
        
        // Validate we have at least one form of transcript
        if (!transcriptText && speakerTranscriptData.length === 0) {
          throw new Error('No transcript content received');
        }
        
        console.log('Raw transcript:', transcriptText);
        console.log('Speaker transcript:', speakerTranscriptData);

        // Step 2: Generate summary
        setProcessingStatus('Generating summary...');
        const fullTranscript = transcriptText || speakerTranscriptData.map((t: { text: string }) => t.text).join('\n');
        
        if (!fullTranscript.trim()) {
          throw new Error('Empty transcript received');
        }
        
        console.log('Sending transcript for summary generation:', fullTranscript);
        
        summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            transcript: fullTranscript,
            meetingId: Date.now().toString(),
            userId: user.email
          })
        });

        if (!summaryResponse.ok) {
          const summaryResponseText = await summaryResponse.text();
          console.error('Summary response:', summaryResponseText);
          throw new Error(`Summary generation failed with status ${summaryResponse.status}: ${summaryResponseText}`);
        }

        const summaryData = await summaryResponse.json();
        console.log('Generated summary data:', summaryData);
        const { 
          emoji: meetingEmoji, 
          name: meetingName, 
          notes: meetingNotes, 
          actionItems: generatedActionItems 
        } = summaryData;

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

        // Combine action items from both sources
        const allActionItems = [...(generatedActionItems || []), ...extractedActionItems];

        // Save to Firestore with user email as document ID
        const timestamp = Date.now();
        const uniqueId = `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;
        
        // Create document with email-based path in timestamps subcollection
        const batch = writeBatch(db);
        
        // Add document to Firestore with only specified fields
        const meetingRef = doc(db, 'transcript', user.email, 'timestamps', uniqueId);
        
        console.log('=== Saving Meeting Document ===');
        console.log('Creating document with path:', `transcript/${user.email}/timestamps/${uniqueId}`);
        console.log('Using meetingRef:', meetingRef.path);
        
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
          transcript: transcriptText,
          type: 'recording',
          actionItems: extractedActionItems.map((item: ActionItem) => ({
            id: `${uniqueId}-${Math.random().toString(36).substring(2, 15)}`,
            title: item.title,
            description: item.description,
            done: false
          }))
        };
        console.log('Meeting Document:', meetingData);
        
        try {
          await batch.set(meetingRef, meetingData);
          console.log('Meeting document added to batch successfully');
        } catch (error) {
          console.error('Error adding meeting document to batch:', error);
          throw error;
        }

        // Save action items to Firestore
        if (allActionItems.length > 0) {
          setProcessingStatus('Saving action items...');
          console.log('=== Processing Action Items ===');
          console.log(`Found ${allActionItems.length} action items to process`);
          
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
          let savedCount = 0;
          
          for (const item of allActionItems) {
            try {
              const actionItemId = `${uniqueId}-${Math.random().toString(36).substring(2, 15)}`;
              const actionItemRef = doc(db, 'transcript', user.email as string, 'actionItems', actionItemId);
              
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
          console.log(`Total action items saved: ${savedCount} of ${allActionItems.length}`);
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
        console.log('=== Starting Automation Processing ===');
        console.log('User:', user.email);
        console.log('Meeting ID:', uniqueId);
        console.log('Meeting Name:', meetingName || 'New Meeting');

        setProcessingStatus('Processing automations...');
        await exportToNotion(user.email);

        console.log('=== Automation Processing Complete ===');

        setIsProcessing(false);
        refreshMeetings();
        onOpenChange(false);

      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      setProcessingStatus('Error: ' + (error instanceof Error ? error.message : 'Failed to process audio'));
      setIsProcessing(false);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <span>{isRecording ? 'Recording...' : 'Ready to Record'}</span>
          </DialogTitle>
          <DialogDescription>
            {isRecording
              ? 'Recording in progress. Speak clearly into the microphone.'
              : 'Press the play button to start recording. The waveform animation reflects audio volume.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div ref={waveformRef} className="w-full bg-gray-50 rounded-lg p-4" />
          <div className="flex items-center justify-center space-x-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                <Play className="w-6 h-6" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors"
              >
                <Square className="w-6 h-6" />
              </button>
            )}
            <div className="text-2xl font-mono">{formatTime(recordingTime)}</div>
          </div>
          {isProcessing && (
            <div className="text-center py-4">
              <div className="animate-pulse text-blue-600 font-medium">{processingStatus}</div>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => onOpenChange(false)}
              className="flex items-center space-x-2 bg-blue-600 text-white rounded-lg py-2 px-4 hover:bg-blue-700 transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Done</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}