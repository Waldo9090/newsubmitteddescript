import { NextResponse } from 'next/server';

const ASSEMBLY_AI_API_KEY = process.env.ASSEMBLY_AI_API_KEY;

if (!ASSEMBLY_AI_API_KEY) {
  console.error('Missing AssemblyAI API key in environment variables');
  throw new Error('Missing AssemblyAI API key');
}

// Validate API key format
if (!ASSEMBLY_AI_API_KEY.match(/^[a-f0-9]{32}$/)) {
  console.warn('AssemblyAI API key format is different than expected');
}

export async function POST(request: Request) {
  try {
    const { audioURL, language_code, speaker_labels } = await request.json();

    if (!audioURL) {
      return NextResponse.json({ error: 'Audio URL is required' }, { status: 400 });
    }

    // Create a transcription request with AssemblyAI
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLY_AI_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioURL,
        language_code: language_code || 'en',
        speaker_labels: speaker_labels || true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI API error: ${response.status}`);
    }

    const transcriptionData = await response.json();
    const transcriptId = transcriptionData.id;

    // Poll for the transcription result
    let result;
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second

      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': process.env.ASSEMBLY_AI_API_KEY || '',
        },
      });

      if (!pollResponse.ok) {
        throw new Error(`AssemblyAI polling error: ${pollResponse.status}`);
      }

      result = await pollResponse.json();

      if (result.status === 'completed') {
        break;
      } else if (result.status === 'error') {
        throw new Error(`Transcription failed: ${result.error}`);
      }
    }

    // Format the response
    const response_data = {
      transcript: result.text,
      speakerTranscript: result.utterances?.map((u: any) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
      })) || [],
    };

    return NextResponse.json(response_data);
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}