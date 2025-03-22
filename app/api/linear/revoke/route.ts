import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    const userEmail = authHeader?.replace('Bearer ', '');

    console.log('[Linear Revoke] Received revoke request:', {
      hasUserEmail: !!userEmail
    });

    if (!userEmail) {
      throw new Error('No user email provided in Authorization header');
    }

    // Get the user's Linear access token from Firestore
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    const linearIntegration = userDoc.data()?.linearIntegration;

    if (!linearIntegration?.accessToken) {
      throw new Error('No Linear access token found for user');
    }

    // Call Linear's revoke endpoint
    const revokeResponse = await fetch('https://api.linear.app/oauth/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${linearIntegration.accessToken}`
      }
    });

    console.log('[Linear Revoke] Revoke response:', {
      status: revokeResponse.status,
      ok: revokeResponse.ok
    });

    // Remove Linear integration data from Firestore
    await setDoc(doc(db, 'users', userEmail), {
      linearIntegration: null
    }, { merge: true });

    console.log('[Linear Revoke] Removed Linear integration from Firestore');

    if (revokeResponse.ok) {
      return NextResponse.json({ success: true });
    } else {
      const errorData = await revokeResponse.text();
      throw new Error(`Failed to revoke token: ${errorData}`);
    }
  } catch (error: any) {
    console.error('[Linear Revoke] Error revoking token:', {
      error,
      stack: error?.stack,
      message: error?.message
    });
    return NextResponse.json(
      { error: error?.message || 'Failed to revoke token' },
      { status: 500 }
    );
  }
} 