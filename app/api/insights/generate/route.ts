import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { transcript, description } = await req.json();

    if (!transcript || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that analyzes meeting transcripts based on specific criteria. Generate insights that are clear, actionable, and valuable.`
        },
        {
          role: "user",
          content: `Based on this meeting transcript, ${description}

Meeting Transcript:
${transcript}

Please provide specific insights that match this criteria. Be concise and specific in your findings.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No content generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error generating insight:', error);
    return NextResponse.json(
      { error: 'Failed to generate insight' },
      { status: 500 }
    );
  }
} 