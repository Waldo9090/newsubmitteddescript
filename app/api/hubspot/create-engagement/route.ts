import { NextResponse } from 'next/server';

interface RequestBody {
  accessToken: string;
  meetingName: string;
  meetingDate: string;
  content: string;
  config: {
    contacts: boolean;
    deals: boolean;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const { accessToken, meetingName, meetingDate, content, config } = body;

    console.log('[HubSpot Create Engagement] Request received:', {
      meetingName,
      meetingDate,
      hasContent: !!content,
      config
    });

    // Create engagement
    const engagement = {
      engagement: {
        active: true,
        type: "MEETING",
        timestamp: new Date(meetingDate).getTime()
      },
      associations: {
        contactIds: [],
        companyIds: [],
        dealIds: [],
        ownerIds: []
      },
      metadata: {
        title: meetingName,
        body: content,
        startTime: meetingDate,
        endTime: new Date(new Date(meetingDate).getTime() + 3600000).toISOString() // Add 1 hour
      }
    };

    // Create the engagement
    const engagementResponse = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(engagement)
    });

    if (!engagementResponse.ok) {
      const errorText = await engagementResponse.text();
      console.error('[HubSpot Create Engagement] Failed to create engagement:', {
        status: engagementResponse.status,
        statusText: engagementResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to create engagement: ${errorText}`);
    }

    const engagementData = await engagementResponse.json();
    console.log('[HubSpot Create Engagement] Successfully created engagement:', {
      engagementId: engagementData.engagement.id
    });

    // If contacts are enabled, search for contacts and associate them
    if (config.contacts) {
      // TODO: Implement contact search and association
      // This would involve:
      // 1. Searching for contacts based on meeting participants
      // 2. Associating found contacts with the engagement
    }

    // If deals are enabled, search for deals and associate them
    if (config.deals) {
      // TODO: Implement deal search and association
      // This would involve:
      // 1. Getting deals associated with the found contacts
      // 2. Associating those deals with the engagement
    }

    return NextResponse.json({ success: true, engagementId: engagementData.engagement.id });
  } catch (error) {
    console.error('[HubSpot Create Engagement] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 