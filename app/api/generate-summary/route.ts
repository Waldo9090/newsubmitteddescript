import { NextResponse } from 'next/server';
import OpenAI from 'openai';

interface ActionItem {
  title: string;
  description: string;
  status: 'Incomplete';
}

interface MeetingSummary {
  name: string;
  emoji: string;
  notes: string;
  actionItems: ActionItem[];
  type: 'recording';
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const generateTitle = async (transcript: string): Promise<string> => {
  try {
    console.log('Generating title for transcript of length:', transcript.length);
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise, descriptive titles (3-5 words) for meeting transcripts."
        },
        {
          role: "user",
          content: `Create a short, descriptive title (3-5 words) for this meeting transcript:\n${transcript}`
        }
      ],
      model: "gpt-3.5-turbo",
    });

    const title = completion.choices[0]?.message?.content?.trim() || "Untitled Meeting";
    console.log('Generated title:', title);
    return title;
  } catch (error) {
    console.error('Error generating title:', error);
    return "Untitled Meeting";
  }
};

const generateEmoji = async (transcript: string): Promise<string> => {
  try {
    console.log('Generating emoji for transcript');
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that selects a single, relevant emoji that best represents a meeting's content. Respond with only the emoji, nothing else."
        },
        {
          role: "user",
          content: `Select a single emoji that best represents this meeting transcript:\n${transcript}`
        }
      ],
      model: "gpt-3.5-turbo",
    });

    const emoji = completion.choices[0]?.message?.content?.trim() || "📝";
    console.log('Generated emoji:', emoji);
    return emoji;
  } catch (error) {
    console.error('Error generating emoji:', error);
    return "📝";
  }
};

const generateNotes = async (transcript: string): Promise<string> => {
  try {
    console.log('Generating notes for transcript');
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates structured notes from meeting transcripts. Create clear, organized notes with main points and key takeaways."
        },
        {
          role: "user",
          content: `Create structured notes from this meeting transcript. Include:
1. Key discussion points
2. Important decisions
3. Notable quotes or statements
4. Main conclusions

Format in markdown with clear sections.

Transcript:
${transcript}`
        }
      ],
      model: "gpt-3.5-turbo",
      max_tokens: 1500,
      temperature: 0.7,
    });

    const notes = completion.choices[0]?.message?.content?.trim() || "No notes generated";
    console.log('Generated notes length:', notes.length);
    return notes;
  } catch (error) {
    console.error('Error generating notes:', error);
    return "Error generating meeting notes";
  }
};

const generateActionItems = async (transcript: string): Promise<ActionItem[]> => {
  try {
    console.log('Generating action items for transcript');
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts action items from meeting transcripts. Respond with ONLY a JSON array, no markdown formatting or explanation."
        },
        {
          role: "user",
          content: `Extract action items from this meeting transcript and return them as a JSON array. Each item should have:
- title: Clear, concise title of what needs to be done
- description: Detailed description with context
- status: Always set to 'Incomplete'

Respond with ONLY the JSON array, no other text.

Transcript:
${transcript}`
        }
      ],
      model: "gpt-3.5-turbo",
    });

    let content = completion.choices[0]?.message?.content?.trim() || '[]';
    
    // Remove any markdown code block formatting if present
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Parse the JSON content
    const actionItems = JSON.parse(content) as Partial<ActionItem>[];
    console.log('Generated action items count:', actionItems.length);
    
    // Validate and ensure each item has required fields
    return actionItems.map(item => ({
      title: item.title || 'Untitled Action Item',
      description: item.description || 'No description provided',
      status: 'Incomplete'
    }));
  } catch (error) {
    console.error('Error generating action items:', error);
    return [];
  }
};

export async function POST(request: Request) {
  try {
    console.log('=== Starting Meeting Summary Generation ===');
    
    const { transcript } = await request.json();
    console.log('Received transcript length:', transcript?.length || 0);

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    // Validate transcript
    if (typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error('Invalid transcript format or empty transcript');
    }

    console.log('Starting parallel API calls for summary generation');
    try {
      // Make parallel API calls for better performance
      const [name, emoji, notes, actionItems] = await Promise.all([
        generateTitle(transcript),
        generateEmoji(transcript),
        generateNotes(transcript),
        generateActionItems(transcript)
      ]);

      const result: MeetingSummary = {
        name,
        emoji,
        notes,
        actionItems,
        type: 'recording'
      };

      console.log('=== Summary Generation Complete ===');
      console.log('Generated summary:', {
        name,
        emoji,
        notesLength: notes.length,
        actionItemsCount: actionItems.length
      });

      return NextResponse.json(result);
    } catch (error: any) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API Error: ${error?.message || 'Unknown OpenAI error'}`);
    }
  } catch (error) {
    console.error('Error in generateMeetingSummary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const fallback: MeetingSummary = {
      name: "Untitled Meeting",
      emoji: "📝",
      notes: `Error generating meeting notes: ${errorMessage}`,
      actionItems: [],
      type: 'recording'
    };
    return NextResponse.json(fallback, { status: 500 });
  }
}