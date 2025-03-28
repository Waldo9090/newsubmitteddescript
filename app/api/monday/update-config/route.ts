import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    // Get user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userEmail = authHeader.replace('Bearer ', '');
    
    // Parse the request body
    const { board, boardName, group, groupName } = await request.json();
    
    if (!board || !boardName || !group || !groupName) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['board', 'boardName', 'group', 'groupName'] 
      }, { status: 400 });
    }
    
    // Get current Monday integration details from Firestore
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists() || !userDoc.data().mondayIntegration) {
      return NextResponse.json({ error: 'Monday integration not found' }, { status: 404 });
    }
    
    const currentIntegration = userDoc.data().mondayIntegration;
    
    if (!currentIntegration.accessToken) {
      return NextResponse.json({ error: 'Monday not connected' }, { status: 400 });
    }
    
    // Update the user document with the new configuration
    await setDoc(doc(db, 'users', userEmail), {
      mondayIntegration: {
        ...currentIntegration,
        board,
        boardName,
        group,
        groupName,
        updatedAt: new Date().toISOString()
      }
    }, { merge: true });
    
    return NextResponse.json({ 
      success: true,
      message: 'Monday configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating Monday configuration:', error);
    return NextResponse.json({ 
      error: 'Failed to update Monday configuration' 
    }, { status: 500 });
  }
} 