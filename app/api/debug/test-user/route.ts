export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Get email from query parameter
    const email = request.nextUrl.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ 
        error: 'Email parameter is required'
      }, { status: 400 });
    }
    
    console.log('Test user debug endpoint called for email:', email);
    
    // Get Firestore db reference
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', email);
    
    // Check if user exists
    const userDoc = await getDoc(userDocRef);
    const userExists = userDoc.exists();
    
    // Create a test user document
    const testData = {
      email,
      testValue: 'This is a test document',
      timestamp: new Date().toISOString(),
      notionIntegration: {
        accessToken: 'test_access_token',
        workspaceId: 'test_workspace_id',
        workspaceName: 'Test Workspace',
        workspaceIcon: null,
        botId: 'test_bot_id',
        updatedAt: new Date().toISOString()
      }
    };
    
    // Create or update the document
    await setDoc(userDocRef, testData, { merge: true });
    
    // Verify it was created
    const verifyDoc = await getDoc(userDocRef);
    const verifyData = verifyDoc.data();
    
    return NextResponse.json({
      success: true,
      message: userExists ? 'Test user document updated' : 'Test user document created',
      previouslyExisted: userExists,
      verifyExists: verifyDoc.exists(),
      verifyData: {
        ...verifyData,
        notionIntegration: {
          ...verifyData?.notionIntegration,
          accessToken: '[REDACTED]'
        }
      }
    });
  } catch (error) {
    console.error('Error in test-user endpoint:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 });
  }
} 