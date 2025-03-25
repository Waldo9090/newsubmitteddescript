import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=${error}`);
    }

    if (!code) {
      console.error('No code received from Attio');
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=no_code`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.attio.com/v2/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.ATTIO_CLIENT_ID,
        client_secret: process.env.ATTIO_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/attio/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Failed to exchange code for token:', error);
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Successfully exchanged code for token');

    // Get workspace information
    const workspaceResponse = await fetch('https://api.attio.com/v2/workspace', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!workspaceResponse.ok) {
      console.error('Failed to get workspace info:', await workspaceResponse.text());
      return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=workspace_info_failed`);
    }

    const workspaceData = await workspaceResponse.json();
    console.log('Successfully retrieved workspace info');

    // Store the access token and workspace info in HTTP-only cookies
    const cookieStore = cookies();
    cookieStore.set('attio_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    cookieStore.set('attio_workspace', JSON.stringify({
      id: workspaceData.id,
      name: workspaceData.name,
    }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    // Redirect back to the integrations page
    const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?success=true`;
    return Response.redirect(returnUrl);
  } catch (error) {
    console.error('Error in Attio callback:', error);
    return Response.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/integrations?error=unknown`);
  }
} 