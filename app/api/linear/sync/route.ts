import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export async function POST(request: Request) {
  try {
    const { meetingId } = await request.json();

    // Get the current user
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get the user's Linear integration details
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, 'users', user.email));
    const linearIntegration = userDoc.data()?.linearIntegration;

    if (!linearIntegration?.accessToken) {
      return NextResponse.json({ error: 'Linear not connected' }, { status: 400 });
    }

    if (!linearIntegration.selectedTeamId) {
      return NextResponse.json({ error: 'No Linear team selected' }, { status: 400 });
    }

    // Get meeting data
    const meetingDoc = await getDoc(doc(db, 'transcript', user.email, 'timestamps', meetingId));
    if (!meetingDoc.exists()) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    const meetingData = meetingDoc.data();
    const actionItems = Object.values(meetingData.actionItems || {});

    if (actionItems.length === 0) {
      return NextResponse.json({ error: 'No action items found' }, { status: 400 });
    }

    // Create issues in Linear
    const createdIssues = await Promise.all(
      actionItems.map(async (item: any) => {
        try {
          const response = await fetch('https://api.linear.app/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${linearIntegration.accessToken}`,
            },
            body: JSON.stringify({
              query: `
                mutation CreateIssue($input: IssueCreateInput!) {
                  issueCreate(input: $input) {
                    success
                    issue {
                      id
                      identifier
                      url
                    }
                  }
                }
              `,
              variables: {
                input: {
                  title: item.text,
                  description: `Created from meeting: ${meetingData.title || 'Untitled Meeting'}\nDate: ${new Date(meetingData.timestamp).toLocaleString()}`,
                  assigneeId: item.assignee, // Assuming this is the Linear user ID
                  teamId: linearIntegration.selectedTeamId,
                  priority: 2, // Normal priority
                }
              },
            }),
          });

          const data = await response.json();
          
          if (data.errors) {
            throw new Error(data.errors[0].message);
          }

          return {
            actionItemId: item.id,
            success: data.data?.issueCreate?.success || false,
            issue: data.data?.issueCreate?.issue,
          };
        } catch (error) {
          console.error('Error creating Linear issue:', error);
          return {
            actionItemId: item.id,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create issue'
          };
        }
      })
    );

    const failures = createdIssues.filter(result => !result.success);
    if (failures.length > 0) {
      return NextResponse.json({
        error: 'Some issues failed to create',
        details: failures
      }, { status: 207 });
    }

    return NextResponse.json({ success: true, issues: createdIssues });
  } catch (error) {
    console.error('Error syncing to Linear:', error);
    return NextResponse.json({
      error: 'Failed to sync with Linear',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 