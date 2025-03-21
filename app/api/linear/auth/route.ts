import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://localhost:3003';
    const clientId = process.env.LINEAR_CLIENT_ID;

    if (!clientId) {
      throw new Error('LINEAR_CLIENT_ID not configured');
    }

    // Construct the Linear OAuth URL
    const linearUrl = new URL('https://linear.app/oauth/authorize');
    linearUrl.searchParams.append('client_id', clientId);
    linearUrl.searchParams.append('redirect_uri', `${baseUrl}/api/linear/callback`);
    linearUrl.searchParams.append('response_type', 'code');
    linearUrl.searchParams.append('scope', 'read,write,issues:create');
    linearUrl.searchParams.append('state', 'random_state'); // You should generate a proper state

    return NextResponse.json({ url: linearUrl.toString() });
  } catch (error) {
    console.error('Error generating Linear auth URL:', error);
    return NextResponse.json({ error: 'Failed to generate authorization URL' }, { status: 500 });
  }
} 