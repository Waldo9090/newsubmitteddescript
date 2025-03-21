import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const accessToken = cookieStore.get('calendar_access_token');
  
  return NextResponse.json({
    connected: !!accessToken
  });
} 