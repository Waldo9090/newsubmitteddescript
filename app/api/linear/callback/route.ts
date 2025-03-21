export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://localhost:3003';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const userId = searchParams.get('state');

    if (error) {
      console.error('Linear OAuth error:', error);
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=linear_auth_failed`);
    }

    if (!code || !userId) {
      console.error('Missing code or userId');
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=missing_params`);
    }

    const response = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.LINEAR_CLIENT_ID || '',
        client_secret: process.env.LINEAR_CLIENT_SECRET || '',
        redirect_uri: `${BASE_URL}/api/linear/callback`,
        code,
      }),
    });

    if (!response.ok) {
      console.error('Failed to exchange code for token:', await response.text());
      return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const { access_token } = await response.json();

    // Store the access token in Firestore
    const userDoc = doc(db, 'users', userId);
    await setDoc(userDoc, {
      linearAccessToken: access_token,
      linearConnectedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?success=true`);
  } catch (error) {
    console.error('Error handling Linear callback:', error);
    return NextResponse.redirect(`${BASE_URL}/dashboard/integrations?error=server_error`);
  }
} 