import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export interface ActionItem {
  title: string;
  description: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that extracts action items from meeting transcripts. Your task is to identify tasks and create clear titles and descriptions for each. You must respond with ONLY a JSON array of action items, with no additional text or explanation.`
        },
        {
          role: "user",
          content: `Extract all action items from the following meeting transcript. For each action item, provide:
1. A clear, concise title (what needs to be done)
2. A detailed description that includes context from the meeting

Format your response as a JSON array of objects with the following structure:
[
  {
    "title": "Concise action item title",
    "description": "Detailed description with context"
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
      
      // If the response is already an array, use it directly
      if (Array.isArray(parsedResponse)) {
        return NextResponse.json({ actionItems: parsedResponse });
      }
      
      // If it has an actionItems array, use that
      if (parsedResponse.actionItems && Array.isArray(parsedResponse.actionItems)) {
        return NextResponse.json(parsedResponse);
      }
      
      // If we couldn't find action items, return an empty array
      return NextResponse.json({ actionItems: [] });
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return NextResponse.json({ actionItems: [] });
    }
  } catch (error) {
    console.error('Error extracting action items:', error);
    return NextResponse.json(
      { error: 'Failed to extract action items' },
      { status: 500 }
    );
  }
} 