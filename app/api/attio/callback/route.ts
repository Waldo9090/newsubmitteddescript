import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { cookies } from 'next/headers';

// Always use the production domain for OAuth flow since Attio app is registered with this domain
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
    
    console.log('Attio callback received:', { 
      code: code?.substring(0, 5) + '...', 
      error, 
      state: state?.substring(0, 5) + '...' 
    });
    
    // Verify state parameter
    const cookieStore = cookies();
    const storedState = cookieStore.get('attio_oauth_state')?.value;
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
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
      console.error('No code received from Attio');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=no_code`);
    }

    // Define Attio OAuth parameters
    const ATTIO_CLIENT_ID = process.env.ATTIO_CLIENT_ID;
    const ATTIO_CLIENT_SECRET = process.env.ATTIO_CLIENT_SECRET;
    const REDIRECT_URI = `${NEXT_PUBLIC_BASE_URL}/api/attio/callback`;
    
    console.log('Using redirect URI for token exchange:', REDIRECT_URI);
    
    if (!ATTIO_CLIENT_ID || !ATTIO_CLIENT_SECRET) {
      console.error('Missing Attio client credentials');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=missing_credentials`);
    }

    // Exchange code for access token as per Attio docs
    console.log('Exchanging code for token...');
    const tokenResponse = await fetch('https://app.attio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: ATTIO_CLIENT_ID,
        client_secret: ATTIO_CLIENT_SECRET,
        grant_type: 'authorization_code', // As specified in Attio docs
        code: code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token', { 
      tokenReceived: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token
    });

    // Verify token by introspecting it (optional but recommended)
    console.log('Verifying token with introspection endpoint...');
    try {
      const introspectResponse = await fetch('https://app.attio.com/oauth/introspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: tokenData.access_token,
        }).toString(),
      });

      if (!introspectResponse.ok) {
        console.warn('Token introspection failed, but continuing with token storage');
      } else {
        const introspectData = await introspectResponse.json();
        console.log('Token introspection successful:', {
          active: introspectData.active,
          scopes: introspectData.scope,
        });
      }
    } catch (introspectError) {
      console.warn('Error during token introspection, but continuing:', introspectError);
    }

    // Get workspace information using the token
    console.log('Fetching workspace info from Attio API...');
    let workspaceData = null;
    try {
      const workspaceResponse = await fetch('https://api.attio.com/v2/workspace', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (workspaceResponse.ok) {
        workspaceData = await workspaceResponse.json();
        console.log('Successfully retrieved workspace info:', {
          workspaceId: workspaceData.data?.id,
          workspaceName: workspaceData.data?.name
        });
      } else {
        console.warn('Failed to get workspace information, but continuing');
      }
    } catch (workspaceError) {
      console.warn('Error fetching workspace data, but continuing:', workspaceError);
    }

    if (!userEmail) {
      console.error('No user email found in cookies');
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
      tokenType: tokenData.token_type || 'bearer',
      expiresIn: tokenData.expires_in,
      workspaceId: workspaceData?.data?.id || null,
      workspaceName: workspaceData?.data?.name || null,
      connectedAt: new Date().toISOString()
    };
    
    console.log('Attio integration data to store:', integrationData);
    
    // Check for required fields
    if (!integrationData.accessTokenFirstChars.includes('...')) {
      console.error('Access token is missing or invalid');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=invalid_access_token`);
    }
    
    try {
      // Update the user document with attioIntegration field
      await setDoc(doc(db, 'users', userEmail), {
        attioIntegration: {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          tokenType: tokenData.token_type || 'bearer',
          expiresIn: tokenData.expires_in,
          expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
          scope: tokenData.scope || '',
          workspaceId: workspaceData?.data?.id || null,
          workspaceName: workspaceData?.data?.name || null,
          connectedAt: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }
      }, { merge: true });
      
      // After storing, verify the data was saved correctly
      const verifyDoc = await getDoc(doc(db, 'users', userEmail));
      if (verifyDoc.exists() && 
          verifyDoc.data().attioIntegration && 
          verifyDoc.data().attioIntegration.accessToken) {
        console.log('Successfully verified Attio integration was saved to Firestore');
      } else {
        console.warn('Attio integration may not have been saved correctly');
      }
      
      console.log('Successfully saved Attio integration for user:', userEmail);
    } catch (storeError) {
      console.error('Error storing Attio integration data:', storeError);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=storage_failed`);
    }

    // Clear OAuth cookies
    cookieStore.delete('user_email');
    cookieStore.delete('attio_oauth_state');

    // Redirect back to the integrations page
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?success=attio_connected`);
  } catch (error) {
    console.error('Error in Attio callback:', error);
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown`);
  }
} 