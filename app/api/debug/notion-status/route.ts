export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Get user email from query parameter
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    
    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }
    
    console.log('Notion status debug endpoint called for user:', email);
    
    // Get the user document from Firestore
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', email);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('User document not found in Firestore for email:', email);
      return NextResponse.json({ 
        exists: false,
        message: 'User document not found in Firestore'
      });
    }
    
    const userData = userDoc.data();
    
    // Check for Notion integration
    const hasNotionIntegration = userData && userData.notionIntegration !== undefined;
    const notionIntegrationKeys = hasNotionIntegration ? Object.keys(userData.notionIntegration || {}) : [];
    
    // Create a safe version of the user document (exclude sensitive data like tokens)
    const safeUserDocument = { ...userData };
    
    // Sanitize sensitive information before sending the response
    if (safeUserDocument.notionIntegration?.accessToken) {
      safeUserDocument.notionIntegration.accessToken = '[REDACTED]';
    }
    
    return NextResponse.json({
      exists: true,
      hasNotionIntegration,
      notionIntegrationKeys,
      // Include the full sanitized document for debugging
      fullUserDocument: safeUserDocument
    });
  } catch (error) {
    console.error('Error in notion-status debug endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 