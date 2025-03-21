import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const userEmail = searchParams.get('state'); // We'll pass user email in state param

  // Get base URL from the request URL
  const baseUrl = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=${error}`);
  }

  if (!code || !userEmail) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=missing_params`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();

    // Store tokens in Firestore
    const userDoc = doc(getFirebaseDb(), 'users', userEmail);
    await setDoc(userDoc, {
      googleCalendar: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
      }
    }, { merge: true });

    // Redirect back to settings with success message
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?success=true`);
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.redirect(`${baseUrl}/dashboard/settings?error=token_exchange_failed`);
  }
}