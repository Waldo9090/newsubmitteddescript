import { NextResponse } from 'next/server';

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;

if (!ASSEMBLY_AI_API_KEY) {
  console.error('Missing AssemblyAI API key in environment variables');
  throw new Error('Missing AssemblyAI API key');
}

// Validate API key format
if (!ASSEMBLY_AI_API_KEY.match(/^[a-f0-9]{32}$/)) {
  console.error('Invalid AssemblyAI API key format');
  throw new Error('Invalid AssemblyAI API key format');
}

export async function POST(request: Request) {
  try {
    const { audioURL } = await request.json();

    if (!audioURL) {
      return NextResponse.json(
        { error: 'No audio URL provided' },
        { status: 400 }
      );
    }

    console.log('Creating transcription for:', audioURL);

    // First, submit the audio file to AssemblyAI
    const headers = {
      'Authorization': ASSEMBLY_AI_API_KEY!,
      'Content-Type': 'application/json'
    } as const;

    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audio_url: audioURL,
        speaker_labels: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AssemblyAI submission error:', error);
      throw new Error(`Failed to submit audio: ${error}`);
    }

    const transcriptionData = await response.json();
    const transcriptId = transcriptionData.id;

    console.log('Transcription submitted, polling for completion:', transcriptId);

    // Poll for completion
    let transcript;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes maximum (with 5-second intervals)
    
    while (attempts < maxAttempts) {
      const pollingResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'Authorization': ASSEMBLY_AI_API_KEY!
          } as const
        }
      );

      if (!pollingResponse.ok) {
        const error = await pollingResponse.text();
        console.error('AssemblyAI polling error:', error);
        throw new Error(`Failed to poll transcript: ${error}`);
      }

      transcript = await pollingResponse.json();
      
      if (transcript.status === 'completed') {
        console.log('Transcription completed:', transcript);
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Transcription timed out');
    }

    // Validate transcript data
    if (!transcript || !transcript.text) {
      console.error('Invalid transcript data received:', transcript);
      return NextResponse.json(
        { error: 'Invalid transcript data received from AssemblyAI' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedResponse = {
      transcript: transcript.text,
      speakerTranscript: transcript.utterances?.map((utterance: any) => ({
        speaker: utterance.speaker || 'Speaker',
        text: utterance.text,
        timestamp: utterance.start,
        duration: utterance.end - utterance.start
      })) || []
    };

    // Validate formatted response
    if (!formattedResponse.transcript && formattedResponse.speakerTranscript.length === 0) {
      console.error('No transcript content in formatted response:', formattedResponse);
      return NextResponse.json(
        { error: 'No transcript content found in AssemblyAI response' },
        { status: 500 }
      );
    }

    console.log('Sending formatted response:', formattedResponse);
    return NextResponse.json(formattedResponse);
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}