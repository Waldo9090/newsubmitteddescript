import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export interface ActionItem {
  text: string;
  assignee?: string;
  dueDate?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const extractActionItems = async (transcript: string): Promise<ActionItem[]> => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that extracts action items from meeting transcripts. Your task is to identify tasks, assignments, and deadlines mentioned in the transcript. You must respond with ONLY a JSON array of action items, with no additional text or explanation.`
        },
        {
          role: "user",
          content: `Extract all action items from the following meeting transcript. For each action item, provide:
1. The text of the action item (what needs to be done)
2. The assignee (who is responsible), if mentioned
3. The due date, if mentioned (in YYYY-MM-DD format)

If no assignee is mentioned, leave it blank. If no due date is mentioned, leave it blank.
Format your response as a JSON array of objects with the following structure:
[
  {
    "text": "Task description",
    "assignee": "Person name or blank",
    "dueDate": "YYYY-MM-DD or blank"
  }
]

Transcript:
${transcript}`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsedResponse = JSON.parse(response);
      return Array.isArray(parsedResponse) ? parsedResponse : [];
    } catch (error) {
      console.error('Error parsing action items:', error);
      return [];
    }
  } catch (error) {
    console.error('Error extracting action items:', error);
    return [];
  }
};

export async function POST(request: Request) {
  try {
    const { transcript, speakerTranscript, meetingId, userId } = await request.json();

    if (!transcript || !meetingId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: {
          transcript: !transcript,
          meetingId: !meetingId,
          userId: !userId
        }
      }, { status: 400 });
    }

    // Generate summary using GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that summarizes meeting transcripts. Create a concise summary that includes:
          1. Key points discussed
          2. Action items (in a clear list format)
          3. Important decisions made
          Format the response in markdown with clear sections.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const summary = completion.choices[0].message.content;

    // Extract action items using a separate prompt
    const actionItemsCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Extract action items from the meeting transcript. For each action item:
          1. Identify the task
          2. Who it's assigned to (if mentioned)
          3. Due date (if mentioned)
          Return as a JSON array of objects with properties: text, assignee (optional), dueDate (optional)`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    let actionItems = [];
    try {
      actionItems = JSON.parse(actionItemsCompletion.choices[0].message.content);
    } catch (error) {
      console.error('Error parsing action items:', error);
      actionItems = [];
    }

    return NextResponse.json({
      summary,
      actionItems,
      meetingId,
      userId
    });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json({ 
      error: 'Failed to generate summary',
      details: error.message
    }, { status: 500 });
  }
}