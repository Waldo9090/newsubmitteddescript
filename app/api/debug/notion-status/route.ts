export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Client } from '@notionhq/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'No email provided' }, { status: 400 });
    }

    // Get user's Notion integration details
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const notionIntegration = userDoc.data()?.notionIntegration;

    if (!notionIntegration?.accessToken) {
      return NextResponse.json({
        connected: false,
        error: 'No Notion access token found'
      });
    }

    // Test the token
    const notion = new Client({
      auth: notionIntegration.accessToken
    });

    try {
      const user = await notion.users.me({});
      
      return NextResponse.json({
        connected: true,
        integration: notionIntegration,
        user: {
          name: user.name,
          type: user.type,
          avatarUrl: user.avatar_url
        }
      });
    } catch (notionError) {
      return NextResponse.json({
        connected: false,
        error: 'Invalid or expired token',
        details: notionError instanceof Error ? notionError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in notion-status debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 