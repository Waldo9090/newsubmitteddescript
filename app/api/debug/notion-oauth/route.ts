export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Client } from '@notionhq/client';

export async function POST(request: NextRequest) {
  console.log('Notion OAuth debug endpoint called');
  
  try {
    // Extract request body
    const body = await request.json();
    const { code, redirectUri, userId } = body;
    
    // Validate required fields
    if (!code) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }
    
    console.log('Debug Notion OAuth processing for user:', userId);
    
    // Check for Notion credentials
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({ 
        error: 'Missing Notion credentials', 
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret
      }, { status: 500 });
    }
    
    // Set default redirect URI if not provided
    const finalRedirectUri = redirectUri || process.env.NOTION_REDIRECT_URI || 'https://localhost:3001/api/notion/callback';
    
    console.log('Exchanging code for access token using redirect URI:', finalRedirectUri);
    
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: finalRedirectUri
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Error exchanging code for token:', tokenData);
      return NextResponse.json({ 
        error: 'Failed to exchange code for token',
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        tokenData
      }, { status: 400 });
    }
    
    console.log('Successfully obtained access token');
    
    // Initialize Notion client to get workspace info
    const notion = new Client({
      auth: tokenData.access_token
    });
    
    // Get workspace info
    console.log('Getting workspace info');
    const workspaceInfo = await notion.users.me({});
    
    // Prepare the integration data to store in Firestore
    const notionIntegrationData = {
      accessToken: tokenData.access_token,
      workspaceId: tokenData.workspace_id,
      workspaceName: workspaceInfo.name,
      workspaceIcon: workspaceInfo.avatar_url || null,
      botId: tokenData.bot_id,
      owner: tokenData.owner || null,
      duplicatedTemplateId: tokenData.duplicated_template_id || null,
      updatedAt: new Date().toISOString()
    };
    
    // Check if user document exists in Firestore
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found, creating new document');
      // Create user document if it doesn't exist
      await setDoc(userDocRef, {
        email: userId,
        notionIntegration: notionIntegrationData,
        createdAt: new Date().toISOString()
      });
    } else {
      console.log('User document exists, updating Notion integration data');
      // Update existing user document
      await setDoc(userDocRef, {
        notionIntegration: notionIntegrationData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    
    // Prepare a safe response without sensitive data
    const safeResponse = {
      success: true,
      workspaceId: tokenData.workspace_id,
      workspaceName: workspaceInfo.name,
      hasAccessToken: !!tokenData.access_token,
      hasBotId: !!tokenData.bot_id,
      owner: tokenData.owner ? {
        type: tokenData.owner.type,
        user: tokenData.owner.user ? {
          id: tokenData.owner.user.id,
          // Don't include name for privacy
        } : null
      } : null,
      firestoreSaved: true
    };
    
    return NextResponse.json(safeResponse);
  } catch (error) {
    console.error('Error in Notion OAuth debug endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'This endpoint only accepts POST requests with code and userId parameters'
  });
} 