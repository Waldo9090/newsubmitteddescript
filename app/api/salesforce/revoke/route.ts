import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    console.log('[Salesforce Revoke] Processing revoke request:', {
      hasUserEmail: !!userEmail
    });

    if (!userEmail) {
      throw new Error('No user email provided in Authorization header');
    }

    // Get user document from Firestore
    const db = getFirebaseDb();
    const userDoc = doc(db, 'users', userEmail);
    const userSnapshot = await getDoc(userDoc);

    if (!userSnapshot.exists()) {
      throw new Error('User document not found');
    }

    const userData = userSnapshot.data();
    const salesforceData = userData.salesforce;

    if (!salesforceData?.accessToken) {
      throw new Error('No Salesforce access token found');
    }

    // Revoke the access token
    const revokeResponse = await fetch('https://login.salesforce.com/services/oauth2/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: salesforceData.accessToken
      })
    });

    if (!revokeResponse.ok) {
      console.warn('[Salesforce Revoke] Failed to revoke token:', await revokeResponse.text());
      // Continue with removal even if revoke fails
    }

    // Remove Salesforce data from user document
    const { salesforce, ...restUserData } = userData;
    await setDoc(userDoc, restUserData);

    console.log('[Salesforce Revoke] Successfully removed Salesforce integration');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Salesforce Revoke] Error revoking access:', {
      error,
      stack: error?.stack,
      message: error?.message
    });
    return NextResponse.json(
      { error: error?.message || 'Failed to revoke Salesforce access' },
      { status: 500 }
    );
  }
} 