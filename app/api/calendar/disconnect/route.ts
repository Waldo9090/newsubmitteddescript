import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Get the cookie store
    const cookieStore = cookies();
    
    // Remove calendar access and refresh tokens
    cookieStore.delete('calendar_access_token');
    cookieStore.delete('calendar_refresh_token');
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Calendar disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to disconnect calendar' 
    }, { status: 500 });
  }
} 