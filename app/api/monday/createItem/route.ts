import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: NextRequest) {
  try {
    // Get user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userEmail = authHeader.replace('Bearer ', '');
    
    // Parse the request body
    const { boardId, groupId, itemName, actionItems } = await request.json();
    
    if (!boardId || !groupId || !itemName) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['boardId', 'groupId', 'itemName'] 
      }, { status: 400 });
    }
    
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
    
    // Create Monday item via API
    const mutation = `
      mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item (
          board_id: $boardId,
          group_id: $groupId,
          item_name: $itemName
        ) {
          id
          name
        }
      }
    `;
    
    const variables = {
      boardId: boardId,
      groupId: groupId,
      itemName: itemName
    };
    
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayData.accessToken
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });
    
    const data = await response.json();
    
    if (data.errors) {
      return NextResponse.json({ 
        error: 'Failed to create Monday item',
        details: data.errors 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      item: data.data.create_item 
    });
  } catch (error) {
    console.error('Error creating Monday item:', error);
    return NextResponse.json({ 
      error: 'Failed to create Monday item' 
    }, { status: 500 });
  }
} 