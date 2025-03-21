import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { transcript, description } = await request.json();

    if (!transcript || !description) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Generate prompt for GPT
    const prompt = `
      Based on the following meeting transcript, ${description}
      
      Meeting Transcript:
      ${transcript}
      
      Please identify specific instances that match this request. Format your response as a concise list of findings.
    `;

    // Get GPT response
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that analyzes meeting transcripts to extract specific insights based on given criteria. Be concise and specific in your findings."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const content = completion.choices[0].message.content;

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    return NextResponse.json({ error: 'Failed to analyze transcript' }, { status: 500 });
  }
} 