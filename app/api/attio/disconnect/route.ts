import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    // Extract user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    const userEmail = authHeader.substring(7);
    if (!userEmail) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Update the user's Attio integration to mark it as disconnected
    const db = getFirebaseDb();
    await setDoc(doc(db, 'users', userEmail, 'integrations', 'attio'), {
      connected: false,
      disconnectedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ 
      success: true,
      message: 'Successfully disconnected from Attio'
    });
  } catch (error) {
    console.error('Error disconnecting from Attio:', error);
    return NextResponse.json({ 
      error: 'Failed to disconnect from Attio' 
    }, { status: 500 });
  }
} 