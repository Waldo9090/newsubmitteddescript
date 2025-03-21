const API_KEY = process.env.NEXT_PUBLIC_ATTENDEE_API_KEY;

if (!API_KEY) {
  console.error('Missing Attendee API key in environment variables');
  throw new Error('Missing Attendee API key');
}

interface BotResponse {
  id: string;
  meeting_url: string;
  state: 'ready' | 'joining' | 'joined_not_recording' | 'joined_recording' | 'leaving' | 'ended' | 'fatal_error' | 'waiting_room';
  events: Array<{
    type: string;
    created_at: string;
  }>;
  transcription_state: 'not_started' | 'in_progress' | 'complete' | 'failed';
  recording_state: 'not_started' | 'in_progress' | 'complete' | 'failed';
}

interface BotStatus {
  id: string;
  state: BotResponse['state'];
  recording_state?: BotResponse['recording_state'];
  transcription_state?: BotResponse['transcription_state'];
}

interface Recording {
  url: string;
  start_timestamp_ms: number;
}

interface TranscriptUtterance {
  speaker_name: string;
  speaker_uuid: string;
  speaker_user_uuid: string | null;
  timestamp_ms: number;
  duration_ms: number;
  transcription: null | string | { transcript: string };
}

async function makeRequest(endpoint: string, options: RequestInit = {}) {
  console.log('Making proxy request:', {
    endpoint,
    method: options.method || 'GET',
    data: options.body ? JSON.parse(options.body as string) : undefined
  });

  try {
    const response = await fetch('/api/attendee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method: options.method || 'GET',
        data: options.body ? JSON.parse(options.body as string) : undefined
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API response:', data);
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to make request: ${error.message}`
        : 'Failed to make request to Attendee API'
    );
  }
}

export async function createBot(meetingUrl: string): Promise<BotResponse> {
  console.log('Creating bot for meeting URL:', meetingUrl);
  try {
    const response = await makeRequest('/bots', {
      method: 'POST',
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'Descript AI',
        transcription_settings: {
          deepgram: {
            language: 'en'
          }
        },
        recording_settings: {
          format: 'webm'
        }
      }),
    });
    console.log('Bot created successfully:', response);
    return response;
  } catch (error) {
    console.error('Failed to create bot:', error);
    throw error;
  }
}

export async function getBotStatus(botId: string): Promise<BotStatus> {
  console.log('Getting status for bot:', botId);
  try {
    const response = await makeRequest(`/bots/${botId}`);
    console.log('Bot status retrieved:', response);
    return response;
  } catch (error) {
    console.error('Failed to get bot status:', error);
    throw error;
  }
}

export async function leaveBot(botId: string): Promise<void> {
  console.log('Leaving bot:', botId);
  try {
    await makeRequest(`/bots/${botId}/leave`, { method: 'POST' });
    console.log('Successfully left bot:', botId);
  } catch (error) {
    console.error('Failed to leave bot:', error);
    throw error;
  }
}

export async function getBotRecording(botId: string): Promise<Recording> {
  console.log('Getting recording for bot:', botId);
  try {
    const response = await makeRequest(`/bots/${botId}/recording`);
    console.log('Recording retrieved:', response);
    return response;
  } catch (error) {
    console.error('Failed to get bot recording:', error);
    throw error;
  }
}

export async function getBotTranscript(botId: string): Promise<TranscriptUtterance[]> {
  console.log('Getting transcript for bot:', botId);
  try {
    const response = await makeRequest(`/bots/${botId}/transcript`);
    console.log('Transcript retrieved:', response);
    return response;
  } catch (error) {
    console.error('Failed to get bot transcript:', error);
    throw error;
  }
}