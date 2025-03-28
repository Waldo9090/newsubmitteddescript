import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { cookies } from 'next/headers';

// Constants
const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID || '';
const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET || '';
const ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENV === 'production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
const CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || 'https://www.aisummarizer-descript.com';

// Use the custom domain in production, otherwise use the base URL
const REDIRECT_BASE = IS_PRODUCTION ? CUSTOM_DOMAIN : BASE_URL;
const REDIRECT_URI = `${REDIRECT_BASE}/api/monday/callback`;
const LOCAL_REDIRECT_BASE = IS_PRODUCTION ? CUSTOM_DOMAIN : BASE_URL;

// Log environment for debugging
console.log('Monday Callback Environment:', {
  environment: ENV,
  isProduction: IS_PRODUCTION,
  baseUrl: BASE_URL,
  customDomain: CUSTOM_DOMAIN,
  redirectUri: REDIRECT_URI,
  localRedirectBase: LOCAL_REDIRECT_BASE,
  hasClientId: !!MONDAY_CLIENT_ID,
  hasClientSecret: !!MONDAY_CLIENT_SECRET
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');
    
    console.log('Monday callback received:', { code: code?.substring(0, 5) + '...', error, state: state?.substring(0, 5) + '...' });
    
    // Verify state parameter
    const cookieStore = cookies();
    const storedState = cookieStore.get('monday_oauth_state')?.value;
    const userEmailCookie = cookieStore.get('user_email');
    let userEmail = userEmailCookie?.value;
    
    console.log('Cookies found:', { 
      hasState: !!storedState, 
      statePrefix: storedState?.substring(0, 5) + '...',
      hasUserEmail: !!userEmail,
      userEmail: userEmail || 'not found'
    });
    
    if (state && storedState && state !== storedState) {
      console.error('State mismatch in OAuth callback');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=invalid_state`);
    }
    
    // Handle errors from OAuth provider
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      
      // Handle specific error for app not installed
      if (error === 'access_denied' && errorDescription?.includes('not installed')) {
        return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
      console.error('No code received from Monday.com');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=no_code`);
    }

    // Define Monday.com OAuth parameters
    const REDIRECT_URI = `${REDIRECT_BASE}/api/monday/callback`;
    
    console.log('Using redirect URI for token exchange:', REDIRECT_URI);
    
    if (!MONDAY_CLIENT_ID || !MONDAY_CLIENT_SECRET) {
      console.error('Missing Monday.com client credentials');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=missing_credentials`);
    }

    // Exchange code for access token
    console.log('Exchanging code for token...');
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: MONDAY_CLIENT_ID,
        client_secret: MONDAY_CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      
      // Check if error is related to app not being installed
      if (errorText.includes('not installed') || errorText.includes('install the app')) {
        return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token', { tokenReceived: !!tokenData.access_token });

    // Get user info from Monday.com API
    console.log('Fetching user info from Monday.com...');
    const userResponse = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { me { id name email account { id name } } }`,
      }),
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Failed to get user info:', errorText);
      
      // Check if error is related to app not being installed
      if (errorText.includes('not installed') || errorText.includes('install the app')) {
        return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    console.log('Successfully retrieved user info:', {
      userId: userData.data?.me?.id,
      userEmail: userData.data?.me?.email,
      accountId: userData.data?.me?.account?.id
    });

    if (!userData.data?.me?.account) {
      console.error('Invalid user account data from Monday.com');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=invalid_account_data`);
    }

    // If no user email from cookie, try to use the email from Monday.com response
    if (!userEmail && userData.data?.me?.email) {
      console.log('No user email found in cookies, using Monday.com email instead');
      const mondayUserEmail = userData.data.me.email;
      
      // Only proceed if it's a valid email format
      if (mondayUserEmail && mondayUserEmail.includes('@') && mondayUserEmail.includes('.')) {
        // Update userEmail variable for Firestore use
        userEmail = mondayUserEmail;
      }
    }

    if (!userEmail) {
      console.error('No user email found in cookies or Monday.com response');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=no_user_email`);
    }

    // Store the token in Firestore
    console.log('Storing token in Firestore for user:', userEmail);
    const db = getFirebaseDb();
    
    try {
      // Get user doc - we're updating the doc directly now
      const userDocRef = doc(db, 'users', userEmail);
      const userDoc = await getDoc(userDocRef);
      
      console.log('Checking user doc exists:', { 
        userDocExists: userDoc.exists(),
        userEmail
      });

      if (!userDoc.exists()) {
        console.error('User document does not exist:', userEmail);
        return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=user_not_found`);
      }
      
      // Format integration data with Timestamps
      const mondayIntegration = {
        connected: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        accountId: userData.data.me.account.id,
        accountName: userData.data.me.account.name,
        userId: userData.data.me.id,
        userEmail: userData.data.me.email,
        userName: userData.data.me.name,
        expiresAt: tokenData.expires_in 
          ? Timestamp.fromDate(new Date(Date.now() + tokenData.expires_in * 1000)) 
          : null,
        connectedAt: Timestamp.fromDate(new Date()),
        updatedAt: serverTimestamp()
      };
      
      console.log('Monday integration data prepared:', {
        connected: mondayIntegration.connected,
        tokenPresent: !!mondayIntegration.accessToken,
        accountId: mondayIntegration.accountId,
        accountName: mondayIntegration.accountName
      });

      // Update the user document with the mondayIntegration field directly
      await updateDoc(userDocRef, {
        mondayIntegration: mondayIntegration
      });
      
      console.log('Successfully stored Monday token in Firestore');
      
      // Clear OAuth cookies
      cookieStore.delete('user_email');
      cookieStore.delete('monday_oauth_state');
      
      console.log('Redirecting to integrations page with email for token verification...');
      // Redirect to the integrations page with a success message
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?success=true&provider=monday&email=${encodeURIComponent(userEmail)}`);
    } catch (error) {
      console.error('Error in Monday OAuth callback:', error);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
  } catch (error) {
    console.error('Error in Monday.com callback:', error);
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown`);
  }
} 