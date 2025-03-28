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
    
    // Make a simple API call to Monday.com to verify the token
    try {
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken
        },
        body: JSON.stringify({
          query: `query { me { id } }`
        })
      });
      
      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Token validation failed: API request failed',
          valid: false
        });
      }
      
      const data = await response.json();
      
      // Check if we got valid data back
      if (data.data?.me?.id) {
        return NextResponse.json({ 
          valid: true,
          userId: data.data.me.id
        });
      } else if (data.errors) {
        return NextResponse.json({ 
          error: 'Token validation failed: ' + data.errors[0]?.message,
          valid: false
        });
      } else {
        return NextResponse.json({ 
          error: 'Token validation failed: Invalid response',
          valid: false
        });
      }
    } catch (error) {
      console.error('Error verifying token with Monday.com API:', error);
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