export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://localhost:3001';
  console.log('Notion callback received with params:', request.nextUrl.searchParams.toString());
  console.log('Using base URL:', baseUrl);
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const userId = searchParams.get('state'); // This should be the user's email

    if (error) {
      console.error('Error from Notion:', error);
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=notion_auth_failed&msg=${encodeURIComponent(error)}`);
    }

    if (!code || !userId) {
      console.error('Missing required parameters in Notion callback:', { hasCode: !!code, hasUserId: !!userId });
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=missing_params`);
    }

    console.log('Notion callback processing for user:', userId);

    // Exchange the code for an access token
    console.log('Exchanging code for access token...');
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${baseUrl}/api/notion/callback`;
    console.log('Using redirect URI:', redirectUri);
    
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error exchanging code for token:', data);
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=token_exchange_failed&msg=${encodeURIComponent(JSON.stringify(data.error))}`);
    }

    console.log('Successfully obtained access token');

    // Initialize Notion client with the access token
    const notion = new Client({
      auth: data.access_token
    });

    // Get workspace info
    console.log('Getting workspace info...');
    const workspaceInfo = await notion.users.me({});
    console.log('Workspace info obtained:', { name: workspaceInfo.name });

    // Store the integration data in Firestore
    const db = getFirebaseDb();
    
    // Check if user document exists
    console.log('Checking if user document exists in Firestore');
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    // Prepare the Notion integration data
    const notionIntegrationData = {
      accessToken: data.access_token,
      workspaceId: data.workspace_id,
      workspaceName: workspaceInfo.name,
      workspaceIcon: workspaceInfo.avatar_url,
      botId: data.bot_id,
      owner: data.owner,
      duplicatedTemplateId: data.duplicated_template_id,
      updatedAt: new Date().toISOString()
    };
    
    try {
      if (!userDoc.exists()) {
        console.log('User document not found, creating new document');
        // Create a new document
        await setDoc(userDocRef, {
          email: userId,
          notionIntegration: notionIntegrationData,
          createdAt: new Date().toISOString()
        });
      } else {
        console.log('User document exists, updating with new Notion integration data');
        // Update existing document
        await setDoc(userDocRef, {
          notionIntegration: notionIntegrationData,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      console.log('Successfully saved Notion integration data to Firestore');
    } catch (firestoreError) {
      console.error('Firestore error saving Notion data:', firestoreError);
      return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=firestore_save_failed&msg=${encodeURIComponent((firestoreError as Error).message)}`);
    }

    // Redirect back to the integrations page
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?success=notion_connected`);
  } catch (error) {
    console.error('Error in Notion callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=internal_error&msg=${encodeURIComponent(errorMessage)}`);
  }
} 