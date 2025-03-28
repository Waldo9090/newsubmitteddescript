import { NextResponse } from 'next/server';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { cookies } from 'next/headers';

// Constants
const ATTIO_CLIENT_ID = process.env.NEXT_PUBLIC_ATTIO_CLIENT_ID || '';
const ATTIO_CLIENT_SECRET = process.env.ATTIO_CLIENT_SECRET || '';
const ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = ENV === 'production';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
const CUSTOM_DOMAIN = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN || 'https://www.aisummarizer-descript.com';

// Use the custom domain in production, otherwise use the base URL
const REDIRECT_BASE = IS_PRODUCTION ? CUSTOM_DOMAIN : BASE_URL;
const REDIRECT_URI = `${REDIRECT_BASE}/api/attio/callback`;
const LOCAL_REDIRECT_BASE = IS_PRODUCTION ? CUSTOM_DOMAIN : BASE_URL;

// Log environment for debugging
console.log('Attio Callback Environment:', {
  environment: ENV,
  isProduction: IS_PRODUCTION,
  baseUrl: BASE_URL,
  customDomain: CUSTOM_DOMAIN,
  redirectUri: REDIRECT_URI,
  localRedirectBase: LOCAL_REDIRECT_BASE,
  hasClientId: !!ATTIO_CLIENT_ID,
  hasClientSecret: !!ATTIO_CLIENT_SECRET
});

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
    const ATTIO_CLIENT_ID = process.env.NEXT_PUBLIC_ATTIO_CLIENT_ID || '';
    const ATTIO_CLIENT_SECRET = process.env.ATTIO_CLIENT_SECRET || '';
    
    console.log('Using redirect URI for token exchange:', REDIRECT_URI);
    
    if (!ATTIO_CLIENT_ID || !ATTIO_CLIENT_SECRET) {
      console.error('Missing Attio client credentials');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=missing_credentials`);
    }

    // Exchange code for access token as per Attio docs
    console.log('Exchanging code for token with Attio...');
    console.log('Token request parameters:', {
      client_id: ATTIO_CLIENT_ID,
      // Securely log partial client secret
      client_secret_prefix: ATTIO_CLIENT_SECRET ? ATTIO_CLIENT_SECRET.substring(0, 4) + '...' : 'missing',
      grant_type: 'authorization_code',
      code_prefix: code.substring(0, 5) + '...',
      redirect_uri: REDIRECT_URI
    });
    
    // Prepare form data for token request
    const formData = new URLSearchParams({
      client_id: ATTIO_CLIENT_ID,
      client_secret: ATTIO_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
    });
    
    console.log('Request body:', formData.toString());
    
    const tokenResponse = await fetch('https://app.attio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: formData.toString(),
    });

    // Log the full response for debugging
    const responseStatus = tokenResponse.status;
    const responseStatusText = tokenResponse.statusText;
    console.log(`Token response status: ${responseStatus} ${responseStatusText}`);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=token_exchange_failed&details=${encodeURIComponent(errorText)}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token:', { 
      tokenReceived: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in
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
    let attioWorkspaceData = { id: null, name: 'Unknown Workspace', logo: null };
    
    // Fetch workspace information
    try {
      console.log('Fetching Attio workspace information...');
      
      const workspaceResponse = await fetch('https://app.attio.com/api/v2/workspaces', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      console.log(`Workspace response status: ${workspaceResponse.status} ${workspaceResponse.statusText}`);
      
      if (!workspaceResponse.ok) {
        const errorText = await workspaceResponse.text();
        console.error('Failed to fetch workspace information:', errorText);
        // Continue with redirection, but log the error
        console.warn('Proceeding without workspace information');
        attioWorkspaceData = { id: null, name: 'Unknown Workspace', logo: null };
      } else {
        const workspaceData = await workspaceResponse.json();
        console.log('Workspace data received:', JSON.stringify(workspaceData, null, 2));
        
        // Ensure we're working with the correct data structure
        if (workspaceData && workspaceData.data) {
          attioWorkspaceData = {
            id: workspaceData.data.id,
            name: workspaceData.data.name,
            logo: workspaceData.data.logo || null
          };
          console.log('Parsed workspace data:', attioWorkspaceData);
        } else {
          console.warn('Unexpected workspace data structure:', workspaceData);
          attioWorkspaceData = { id: null, name: 'Unknown Workspace', logo: null };
        }
      }
    } catch (error) {
      console.error('Error fetching workspace information:', error);
      attioWorkspaceData = { id: null, name: 'Unknown Workspace', logo: null };
    }

    if (!userEmail) {
      console.error('No user email found in cookies');
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=no_user_email`);
    }

    // Store the token in Firestore
    console.log('Storing token in Firestore for user:', userEmail);
    const db = getFirebaseDb();
    
    // After introspecting the token and updating the user's record in Firebase
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

      // Now store the token in Firestore
      console.log('Storing Attio token in Firestore...');
      
      // Calculate expiry time
      const expiresIn = tokenData.expires_in || 3600; // Default to 1 hour if not provided
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
      
      // Format integration data
      const attioIntegration = {
        connected: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
        expiresAt: Timestamp.fromDate(expiresAt),
        connectedAt: Timestamp.fromDate(new Date()),
        workspaceId: attioWorkspaceData.id,
        workspaceName: attioWorkspaceData.name,
        workspaceLogo: attioWorkspaceData.logo,
      };
      
      console.log('Attio integration data prepared:', {
        connected: attioIntegration.connected,
        tokenPresent: !!attioIntegration.accessToken,
        refreshTokenPresent: !!attioIntegration.refreshToken,
        workspaceId: attioIntegration.workspaceId,
        workspaceName: attioIntegration.workspaceName
      });

      // Update the user document with the attioIntegration field directly
      await updateDoc(userDocRef, {
        attioIntegration: attioIntegration
      });
      
      console.log('Successfully stored Attio token in Firestore');

      // Clear OAuth cookies
      cookieStore.delete('user_email');
      cookieStore.delete('attio_oauth_state');
      
      console.log('Redirecting to integrations page with email for token verification...');
      // Redirect to the integrations page with a success message
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?success=true&provider=attio&email=${encodeURIComponent(userEmail)}`);
    } catch (error) {
      console.error('Error in Attio OAuth callback:', error);
      return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
  } catch (error) {
    console.error('Error in Attio callback:', error);
    return Response.redirect(`${LOCAL_REDIRECT_BASE}/dashboard/integrations?error=unknown`);
  }
} 