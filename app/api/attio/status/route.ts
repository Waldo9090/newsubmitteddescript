import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(request: Request) {
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

    // Check if the user has a valid Attio integration - directly in the user document
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', userEmail);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists() || !userDoc.data().attioIntegration || !userDoc.data().attioIntegration.connected) {
      return NextResponse.json({ 
        connected: false,
        message: 'No active Attio connection found'
      });
    }

    const attioData = userDoc.data().attioIntegration;
    
    // Check if token is expired
    if (attioData.expiresAt) {
      const expiryDate = new Date(attioData.expiresAt);
      if (expiryDate < new Date()) {
        return NextResponse.json({ 
          connected: false,
          message: 'Attio connection has expired',
          expired: true
        });
      }
    }

    // Return connection status and workspace info
    return NextResponse.json({
      connected: true,
      workspace: {
        id: attioData.workspaceId || '',
        name: attioData.workspaceName || '',
        logo: attioData.workspaceLogo || null
      },
      scopes: attioData.scope?.split(' ') || [],
      connectedAt: attioData.connectedAt
    });
  } catch (error) {
    console.error('Error checking Attio connection status:', error);
    return NextResponse.json({ 
      error: 'Failed to check Attio connection status' 
    }, { status: 500 });
  }
} 