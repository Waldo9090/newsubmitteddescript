import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface InsightConfig {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  frequency: "auto" | "one" | "multiple";
}

interface InsightRequest {
  transcript: string;
  meetingId: string;
  meetingName: string;
  userId: string;
  insightConfigs: InsightConfig[];
}

export async function POST(request: Request) {
  try {
    console.log('Received insight generation request');
    const { transcript, meetingId, meetingName, userId, insightConfigs } = await request.json() as InsightRequest;

    // Validate required fields
    if (!transcript) {
      console.error('Missing transcript');
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }
    
    if (!meetingId) {
      console.error('Missing meetingId');
      return NextResponse.json({ error: 'Missing meetingId' }, { status: 400 });
    }
    
    if (!userId) {
      console.error('Missing userId');
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    if (!insightConfigs || !Array.isArray(insightConfigs)) {
      console.error('Missing or invalid insightConfigs');
      return NextResponse.json({ error: 'Missing or invalid insightConfigs' }, { status: 400 });
    }

    const enabledConfigs = insightConfigs.filter(config => config.enabled);
    console.log(`Found ${enabledConfigs.length} enabled insight configs`);
    
    if (enabledConfigs.length === 0) {
      console.log('No enabled insight configs found');
      return NextResponse.json({ insights: [] });
    }

    console.log('Generating insights for meeting:', meetingId);
    const insights = await Promise.all(
      enabledConfigs.map(async (config) => {
        try {
          console.log(`Generating insight for template: ${config.name}`);
          const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant that generates specific insights from meeting transcripts based on given templates. Generate insights that are clear, actionable, and valuable for business decision-making.`
              },
              {
                role: "user",
                content: `Generate insights for the following meeting transcript based on this template:
Template Name: ${config.name}
Template Description: ${config.description}
Frequency: ${config.frequency}

Please provide insights that match the template's purpose. Focus on extracting meaningful patterns, key decisions, and actionable recommendations.

Transcript:
${transcript}`
              }
            ],
            temperature: 0.7,
            max_tokens: 1000
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No content generated');
          }

          // Generate a unique ID with timestamp and random string
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 11);
          const id = `insight_${timestamp}_${randomId}`;

          console.log(`Successfully generated insight for template: ${config.name}`);
          return {
            id,
            meetingId,
            meetingName: meetingName || 'Untitled Meeting',
            userId,
            insightType: config.name,
            content,
            createdAt: timestamp
          };
        } catch (error) {
          console.error(`Error generating insight for template ${config.name}:`, error);
          return null;
        }
      })
    );

    // Filter out any failed insights
    const validInsights = insights.filter((insight): insight is NonNullable<typeof insight> => insight !== null);
    console.log(`Generated ${validInsights.length} valid insights`);

    return NextResponse.json({ insights: validInsights });
  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 