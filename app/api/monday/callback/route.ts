import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { cookies } from 'next/headers';

// Always use the production domain for OAuth flow since Monday.com app is registered with this domain
const NEXT_PUBLIC_BASE_URL = 'https://www.aisummarizer-descript.com';
// For local redirection after OAuth, use current environment
const isDevelopment = process.env.NODE_ENV === 'development';
const LOCAL_REDIRECT_BASE = isDevelopment ? 'http://localhost:3001' : NEXT_PUBLIC_BASE_URL;

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
    const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
    const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
    const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/monday/callback`;
    
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
    
    // Log the data we're about to store (with partial token for security)
    const integrationData = {
      connected: true,
      accessTokenFirstChars: tokenData.access_token ? tokenData.access_token.substring(0, 8) + '...' : 'missing',
      hasRefreshToken: !!tokenData.refresh_token,
      accountId: userData.data.me.account.id,
      accountName: userData.data.me.account.name,
      userId: userData.data.me.id,
      userEmail: userData.data.me.email,
      userName: userData.data.me.name,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
      connectedAt: new Date().toISOString()
    };
    
    console.log('Monday.com integration data to store:', integrationData);
    
    // Check for required fields
    if (!integrationData.accessTokenFirstChars.includes('...')) {
      console.error('Access token is missing or invalid');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=invalid_access_token`);
    }
    
    if (!integrationData.accountId || !integrationData.userId) {
      console.error('Missing required integration data');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=missing_integration_data`);
    }
    
    try {
      // Update the user document with mondayIntegration field
      await setDoc(doc(db, 'users', userEmail), {
        mondayIntegration: {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          accountId: userData.data.me.account.id,
          accountName: userData.data.me.account.name,
          userId: userData.data.me.id,
          userEmail: userData.data.me.email,
          userName: userData.data.me.name,
          expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
          connectedAt: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }
      }, { merge: true });
      
      // After storing, verify the data was saved correctly
      const verifyDoc = await getDoc(doc(db, 'users', userEmail));
      if (verifyDoc.exists() && 
          verifyDoc.data().mondayIntegration && 
          verifyDoc.data().mondayIntegration.accessToken) {
        console.log('Successfully verified Monday.com integration was saved to Firestore');
      } else {
        console.warn('Monday.com integration may not have been saved correctly');
      }
      
      console.log('Successfully saved Monday.com integration for user:', userEmail);
    } catch (storeError) {
      console.error('Error storing Monday.com integration data:', storeError);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=storage_failed`);
    }

    // Clear OAuth cookies
    cookieStore.delete('user_email');
    cookieStore.delete('monday_oauth_state');

    // Redirect back to the integrations page
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?success=monday_connected`);
  } catch (error) {
    console.error('Error in Monday.com callback:', error);
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown`);
  }
} 