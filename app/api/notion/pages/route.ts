import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Get user email from Authorization header
    const userEmail = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Notion access token from Firestore
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const notionToken = userDoc.data()?.notionIntegration?.accessToken;

    if (!notionToken) {
      return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }

    // Initialize Notion client
    const notion = new Client({
      auth: notionToken
    });

    // Fetch pages and databases
    const [pagesResponse, dbResponse] = await Promise.all([
      notion.search({
        filter: {
          property: 'object',
          value: 'page'
        }
      }),
      notion.search({
        filter: {
          property: 'object',
          value: 'database'
        }
      })
    ]);

    // Process and combine results
    const pages = pagesResponse.results.map(page => ({
      id: page.id,
      title: page.object === 'page' && 'properties' in page ? 
        (page.properties.title?.type === 'title' ? 
          page.properties.title.title[0]?.plain_text : 'Untitled') : 
        'Untitled',
      type: 'page',
      icon: page.object === 'page' && 'icon' in page ? page.icon : undefined
    }));

    const databases = dbResponse.results.map(db => ({
      id: db.id,
      title: db.object === 'database' && 'title' in db ? 
        db.title[0]?.plain_text : 'Untitled Database',
      type: 'database',
      icon: db.object === 'database' && 'icon' in db ? db.icon : undefined
    }));

    return NextResponse.json({
      pages: [...pages, ...databases]
    });
  } catch (error) {
    console.error('Error fetching Notion pages:', error);
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
  }
} 