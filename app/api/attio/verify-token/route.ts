import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get user email from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse the request body
    const { accessToken } = await request.json();
    
    if (!accessToken) {
      return NextResponse.json({ 
        error: 'Missing access token',
        valid: false
      }, { status: 400 });
    }
    
    // Make a simple API call to Attio to verify the token
    try {
      // Using the workspace endpoint as a simple check
      const response = await fetch('https://api.attio.com/v2/workspace', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ 
          error: `Token validation failed: ${errorText}`,
          valid: false
        });
      }
      
      const data = await response.json();
      
      // Check if we got valid workspace data back
      if (data.data?.id) {
        return NextResponse.json({ 
          valid: true,
          workspaceId: data.data.id,
          workspaceName: data.data.name
        });
      } else {
        return NextResponse.json({ 
          error: 'Token validation failed: Invalid response',
          valid: false
        });
      }
    } catch (error) {
      console.error('Error verifying token with Attio API:', error);
      return NextResponse.json({ 
        error: 'Token validation request failed',
        valid: false
      });
    }
  } catch (error) {
    console.error('Error in verify-token endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      valid: false
    }, { status: 500 });
  }
} 