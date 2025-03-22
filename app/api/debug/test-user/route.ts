export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json({ error: 'No email provided' }, { status: 400 });
    }

    // Get user document from Firestore
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));

    if (!userDoc.exists()) {
      return NextResponse.json({
        exists: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();
    
    return NextResponse.json({
      exists: true,
      userData: userData
    });

  } catch (error) {
    console.error('Error in test-user debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 