import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    // Use the correct base URL based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const BASE_URL = isDevelopment ? 'https://localhost:3001' : process.env.NEXT_PUBLIC_BASE_URL;
    
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');
    
    // Verify state parameter
    const cookieStore = cookies();
    const storedState = cookieStore.get('monday_oauth_state')?.value;
    
    if (state && storedState && state !== storedState) {
      console.error('State mismatch in OAuth callback');
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=invalid_state`);
    }
    
    // Handle errors from OAuth provider
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      
      // Handle specific error for app not installed
      if (error === 'access_denied' && errorDescription?.includes('not installed')) {
        return Response.redirect(`${BASE_URL}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
      console.error('No code received from Monday.com');
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=no_code`);
    }

    // Define Monday.com OAuth parameters
    const MONDAY_CLIENT_ID = process.env.MONDAY_CLIENT_ID;
    const MONDAY_CLIENT_SECRET = process.env.MONDAY_CLIENT_SECRET;
    
    const REDIRECT_URI = `${BASE_URL}/api/monday/callback`;
    
    console.log('Using Monday.com redirect URI:', REDIRECT_URI);
    
    if (!MONDAY_CLIENT_ID || !MONDAY_CLIENT_SECRET) {
      console.error('Missing Monday.com client credentials');
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=missing_credentials`);
    }

    // Exchange code for access token
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
        return Response.redirect(`${BASE_URL}/dashboard/integrations?error=app_not_installed`);
      }
      
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token');

    // Get user info from Monday.com API
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
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    console.log('Successfully retrieved user info');

    if (!userData.data?.me?.account) {
      console.error('Invalid user account data from Monday.com');
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=invalid_account_data`);
    }

    // Get email from cookies, which would have been set during the auth flow
    const userEmailCookie = cookieStore.get('user_email');
    let userEmail = userEmailCookie?.value;
    
    console.log('User email from cookie:', { 
      hasUserEmail: !!userEmail,
      userEmailRaw: userEmail
    });
    
    // Check if the email is URL encoded and decode it if necessary
    if (userEmail && userEmail.includes('%')) {
      try {
        userEmail = decodeURIComponent(userEmail);
        console.log('Decoded user email:', userEmail);
      } catch (e) {
        console.error('Error decoding user email:', e);
      }
    }

    if (!userEmail) {
      console.error('No user email found in cookies');
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=no_user_email`);
    }

    // Store the token in Firestore
    const db = getFirebaseDb();
    
    // Log the data we're about to save
    console.log('Saving Monday.com integration data for user:', userEmail);
    console.log('Token data received:', {
      hasAccessToken: !!tokenData.access_token,
      tokenLength: tokenData.access_token?.length || 0,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in || 'not provided'
    });
    console.log('User data received:', {
      userId: userData.data?.me?.id,
      userName: userData.data?.me?.name,
      userEmail: userData.data?.me?.email,
      accountId: userData.data?.me?.account?.id,
      accountName: userData.data?.me?.account?.name
    });
    
    try {
      // First check if the user document exists
      const userDocRef = doc(db, 'users', userEmail);
      const userDoc = await getDoc(userDocRef);
      
      console.log('User document check:', {
        exists: userDoc.exists(),
        path: userDocRef.path
      });
      
      // Define the integration data
      const mondayIntegration = {
        connected: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || '',
        accountId: userData.data.me.account.id,
        workspaceId: userData.data.me.account.id,
        workspaceName: userData.data.me.account.name,
        userId: userData.data.me.id,
        userName: userData.data.me.name,
        userEmail: userData.data.me.email,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
        connectedAt: new Date().toISOString(),
        config: {
          items: true,
          boards: true,
          includeMeetingNotes: true,
          includeActionItems: true,
        },
        updatedAt: serverTimestamp(),
      };
      
      console.log('Integration data prepared with token length:', tokenData.access_token?.length);
      
      if (!userDoc.exists()) {
        // Create a new document if it doesn't exist
        console.log('Creating new user document with integration data');
        await setDoc(userDocRef, {
          email: userEmail,
          mondayIntegration: mondayIntegration,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // Update existing document with updateDoc for more reliable updates
        console.log('Updating existing user document with updateDoc');
        await updateDoc(userDocRef, {
          'mondayIntegration': mondayIntegration,
          'updatedAt': serverTimestamp()
        });
      }
      
      // Verify the data was saved
      const verifyDoc = await getDoc(doc(db, 'users', userEmail));
      if (verifyDoc.exists() && verifyDoc.data().mondayIntegration?.accessToken) {
        console.log('✅ Successfully verified Monday.com integration was saved');
      } else {
        console.error('❌ Monday.com integration was not saved correctly');
        console.log('Document data after save:', verifyDoc.exists() ? 
          JSON.stringify({
            hasIntegration: !!verifyDoc.data().mondayIntegration,
            integrationKeys: verifyDoc.data().mondayIntegration ? Object.keys(verifyDoc.data().mondayIntegration) : [],
            docKeys: Object.keys(verifyDoc.data())
          }) : 'document does not exist');
          
        // Try one more time with setDoc and merge: true
        console.log('Attempting one more save with setDoc and merge: true');
        await setDoc(doc(db, 'users', userEmail), {
          mondayIntegration: mondayIntegration
        }, { merge: true });
      }
      
      console.log('Saved Monday.com integration for user:', userEmail);
    } catch (error) {
      console.error('Error saving Monday.com integration:', error);
      return Response.redirect(`${BASE_URL}/dashboard/integrations?error=storage_failed&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }

    // Clear OAuth cookies
    cookieStore.delete('user_email');
    cookieStore.delete('monday_oauth_state');

    // Redirect back to the integrations page
    return Response.redirect(`${BASE_URL}/dashboard/integrations?success=true&provider=monday`);
  } catch (error) {
    console.error('Error in Monday.com callback:', error);
    // Use the correct base URL even in error case
    const isDevelopment = process.env.NODE_ENV === 'development';
    const BASE_URL = isDevelopment ? 'https://localhost:3001' : process.env.NEXT_PUBLIC_BASE_URL;
    return Response.redirect(`${BASE_URL}/dashboard/integrations?error=unknown`);
  }
} 