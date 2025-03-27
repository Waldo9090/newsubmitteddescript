import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('calendar_access_token');
    const refreshToken = cookieStore.get('calendar_refresh_token');
    
    const isConnected = !!accessToken;
    
    return NextResponse.json({
      connected: isConnected,
      hasRefreshToken: !!refreshToken,
      lastChecked: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    return NextResponse.json({ 
      error: 'Failed to check calendar status' 
    }, { status: 500 });
  }
} 