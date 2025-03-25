import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { user } = await request.json();
    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get meeting data
    const db = getFirebaseDb();
    const meetingRef = doc(db, 'transcript', user.email, 'timestamps', params.meetingId);
    const meetingDoc = await getDoc(meetingRef);
    
    if (!meetingDoc.exists()) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();
    
    // Get user's settings and check integrations
    const userRef = doc(db, 'users', user.email);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    
    // Get all automations for the user
    const automationsRef = collection(db, 'savedautomations');
    const automationsQuery = query(automationsRef, where('userId', '==', user.email));
    const automationsSnapshot = await getDocs(automationsQuery);
    
    if (automationsSnapshot.empty) {
      return NextResponse.json({ message: 'No automations found for user' });
    }
    
    // Process each automation
    const automationResults = await Promise.all(
      automationsSnapshot.docs.map(async (automationDoc) => {
        const automation = automationDoc.data();
        
        // Skip disabled automations
        if (!automation.enabled) {
          return {
            id: automationDoc.id,
            type: 'skip',
            message: 'Automation is disabled'
          };
        }
        
        // Check if tags match, if tags are specified
        const automationTags = automation.tags || [];
        const meetingTags = meetingData.tags || [];
        
        if (automationTags.length > 0 && !automationTags.some((tag: string) => meetingTags.includes(tag))) {
          return {
            id: automationDoc.id,
            type: 'skip',
            message: 'Meeting tags do not match automation tags'
          };
        }
        
        // Process each step in the automation
        const stepResults = await Promise.all(
          (automation.steps || []).map(async (step: any) => {
            try {
              // Handle Monday.com steps
              if (step.type === 'monday') {
                // Check if Monday.com is connected
                if (!userData.monday?.accessToken) {
                  return {
                    type: 'monday',
                    status: 'error',
                    message: 'Monday.com is not connected'
                  };
                }
                
                // Prepare meeting data for Monday.com
                const meetingTitle = meetingData.title || 'Untitled Meeting';
                const meetingDate = meetingData.date || meetingData.completedAt || new Date().toISOString();
                
                // Get attendees if available
                const attendees = meetingData.attendees || [];
                
                // Get action items
                const actionItems = Object.values(meetingData.actionItems || {})
                  .map((item: any) => `${item.text}${item.assignee ? ` (Assigned to: ${item.assignee})` : ''}`)
                
                // Call the Monday.com API endpoint to create an item
                const response = await fetch('/api/monday/createItem', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    userEmail: user.email,
                    automationId: automationDoc.id,
                    meetingTitle,
                    meetingDate,
                    meetingAttendees: attendees,
                    meetingNotes: meetingData.notes || '',
                    meetingActionItems: actionItems
                  })
                });
                
                const result = await response.json();
                
                if (!response.ok) {
                  return {
                    type: 'monday',
                    status: 'error',
                    message: result.error || 'Failed to create Monday.com item'
                  };
                }
                
                return {
                  type: 'monday',
                  status: 'success',
                  message: 'Created item in Monday.com',
                  itemId: result.itemId
                };
              }
              
              // Handle other step types (already implemented elsewhere)
              return {
                type: step.type,
                status: 'skipped',
                message: `Step type ${step.type} processed by other systems`
              };
            } catch (error) {
              console.error(`Error processing ${step.type} step:`, error);
              return {
                type: step.type,
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
              };
            }
          })
        );
        
        return {
          id: automationDoc.id,
          name: automation.name,
          steps: stepResults
        };
      })
    );
    
    return NextResponse.json({ 
      success: true, 
      message: 'Automations processed',
      results: automationResults
    });
  } catch (error) {
    console.error('Error processing automations:', error);
    return NextResponse.json({
      error: 'Failed to process automations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 