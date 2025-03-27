import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function GET(req: NextRequest) {
  try {
    // Get user email from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userEmail = authHeader.replace('Bearer ', '');
    
    // Get Monday integration details from Firestore
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', userEmail));
    
    if (!userDoc.exists() || !userDoc.data().mondayIntegration) {
      return NextResponse.json({ error: 'Monday integration not found' }, { status: 404 });
    }
    
    const mondayData = userDoc.data().mondayIntegration;
    
    if (!mondayData.accessToken) {
      return NextResponse.json({ error: 'Monday not connected' }, { status: 400 });
    }
    
    // Fetch boards from Monday API
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayData.accessToken
      },
      body: JSON.stringify({
        query: `query { boards { id name } }`
      })
    });
    
    const data = await response.json();
    
    if (data.errors) {
      return NextResponse.json({ 
        error: 'Failed to fetch Monday boards',
        details: data.errors 
      }, { status: 500 });
    }
    
    return NextResponse.json({ boards: data.data.boards });
  } catch (error) {
    console.error('Error fetching Monday boards:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Monday boards' 
    }, { status: 500 });
  }
} 