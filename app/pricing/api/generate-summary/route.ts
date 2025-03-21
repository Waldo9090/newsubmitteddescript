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

    return completion.choices[0]?.message?.content?.trim() || "Untitled Meeting";
  } catch (error) {
    console.error('Error generating title:', error);
    return "Untitled Meeting";
  }
};

const generateEmoji = async (transcript: string): Promise<string> => {
  try {
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

    return completion.choices[0]?.message?.content?.trim() || "📝";
  } catch (error) {
    console.error('Error generating emoji:', error);
    return "📝";
  }
};

const generateActionItems = async (transcript: string): Promise<ActionItem[]> => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts action items from meeting transcripts. Respond with ONLY a JSON array, no markdown formatting or explanation."
        },
        {
          role: "user",
          content: `Extract action items from this meeting transcript and return them as a JSON array. Each item should have these fields:
- title: Clear, concise title of what needs to be done
- description: Detailed description with context
- status: Always set to 'Incomplete'

Respond with ONLY the JSON array, no other text or formatting.

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

const generateNotes = async (transcript: string): Promise<string> => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates structured notes from meeting transcripts with timestamps. Focus on organization and clarity. Follow strict formatting rules for markdown output."
        },
        {
          role: "user",
          content: `**Important:**
- Generate notes based on the full transcription provided below.
- For each major section or bullet point, include the corresponding timestamp(s) (in MM:SS format) from the original transcription where that information appears. Only include them on important titles and subtitles not every bullet points.
- If a section covers multiple timestamps, list them separated by commas.
- If no timestamp is available, simply omit that detail.

Follow these strict formatting rules:
    1. Add two newlines (\\n\\n) before each header
    2. Add one newline (\\n) after each header
    3. Add two newlines (\\n\\n) between major sections
    4. Add one newline (\\n) between list items
    5. Add two newlines (\\n\\n) after lists
    6. Format using:
       - # for main title (with two newlines after)
       - ## for major sections (with one newline after)
       - ### for subsections (with one newline after)
       - * for bullet points (with one newline after each)
       - > for quotes (with two newlines after)

Example format:
# Main Title\\n\\n

## Section Title (Timestamp: 01:23)\\n
Content here\\n\\n

* Bullet point (Timestamp: 01:23)\\n
* Another bullet point (Timestamp: 01:45)\\n\\n

## Another Section (Timestamp: 02:00)\\n

Transcript:
${transcript}`
        }
      ],
      model: "gpt-3.5-turbo",
    });

    return completion.choices[0]?.message?.content?.trim() || "Error generating meeting notes";
  } catch (error) {
    console.error('Error generating notes:', error);
    return "Error generating meeting notes";
  }
};

export async function POST(request: Request) {
  try {
    // Log OpenAI key presence (not the actual key)
    console.log('OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

    const { transcript } = await request.json();
    console.log('Received transcript for processing:', transcript);

    if (!transcript) {
      throw new Error('No transcript provided');
    }

    // Validate transcript
    if (typeof transcript !== 'string' || transcript.trim().length === 0) {
      throw new Error('Invalid transcript format');
    }

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

      console.log('Generated meeting summary:', result);
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