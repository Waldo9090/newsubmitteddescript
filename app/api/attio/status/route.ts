import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = authHeader.split('Bearer ')[1];
    if (!userEmail) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get the Attio access token from cookies
    const cookieStore = cookies();
    const attioToken = cookieStore.get('attio_access_token');

    if (!attioToken?.value) {
      return NextResponse.json({
        connected: false,
        workspaces: [],
        selectedWorkspace: null
      });
    }

    // Verify the token by fetching workspaces
    const workspacesResponse = await fetch('https://api.attio.com/v2/workspaces', {
      headers: {
        'Authorization': `Bearer ${attioToken.value}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workspacesResponse.ok) {
      // Token might be invalid, clear it
      cookieStore.delete('attio_access_token');
      return NextResponse.json({
        connected: false,
        workspaces: [],
        selectedWorkspace: null
      });
    }

    const workspaces = await workspacesResponse.json();
    
    return NextResponse.json({
      connected: true,
      workspaces: workspaces.data || [],
      selectedWorkspace: workspaces.data?.[0] || null
    });
  } catch (error) {
    console.error('Error checking Attio status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 