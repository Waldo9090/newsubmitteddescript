import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'No email provided' }, { status: 400 });
    }

    const clientId = process.env.NOTION_CLIENT_ID || '';
    const clientSecret = process.env.NOTION_CLIENT_SECRET || '';
    const redirectUri = process.env.NOTION_REDIRECT_URI || '';

    // Get user's Notion integration details
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const notionIntegration = userDoc.data()?.notionIntegration;

    return NextResponse.json({
      clientId,
      clientSecret,
      redirectUri,
      notionIntegration,
      hasToken: !!notionIntegration?.accessToken,
      tokenLength: notionIntegration?.accessToken?.length || 0
    });
  } catch (error) {
    console.error('Error in notion-redirect debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 