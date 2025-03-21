import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { user } = await request.json();
    if (!user?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Update meeting status
    const db = getFirebaseDb();
    const meetingRef = doc(db, 'transcript', user.email, 'timestamps', params.meetingId);
    await updateDoc(meetingRef, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    // Send Slack notification
    try {
      await fetch(`/api/meetings/${params.meetingId}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user }),
      });
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      // Don't fail the completion if notification fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing meeting:', error);
    return NextResponse.json({
      error: 'Failed to complete meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 