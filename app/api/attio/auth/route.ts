import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = authHeader.split('Bearer ')[1];
    if (!userEmail) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify environment variables
    const ATTIO_CLIENT_ID = process.env.ATTIO_CLIENT_ID;
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
    
    if (!ATTIO_CLIENT_ID || !BASE_URL) {
      console.error('Missing required environment variables:', {
        hasClientId: !!ATTIO_CLIENT_ID,
        hasBaseUrl: !!BASE_URL
      });
      return NextResponse.json({ error: 'Missing required configuration' }, { status: 500 });
    }

    // Generate a state parameter for security
    const state = randomBytes(16).toString('hex');

    // Define scopes exactly as configured in Attio settings
    const scopes = [
      'read_user_management',     // View workspace members
      'read_public_collections',  // View public collections
      'read_records',            // Records (Read-write)
      'write_records',           // Records (Read-write)
      'read_configuration',      // Object Configuration (Read)
      'read_notes',             // Notes (Read-write)
      'write_notes',            // Notes (Read-write)
      'read_tasks',             // Tasks (Read-write)
      'write_tasks'             // Tasks (Read-write)
    ];

    console.log('Generating Attio auth URL with scopes:', scopes);

    // Construct the Attio OAuth URL with prompt=consent to force workspace selection
    const authUrl = `https://app.attio.com/oauth/authorize?` + new URLSearchParams({
      client_id: ATTIO_CLIENT_ID,
      redirect_uri: `${BASE_URL}/api/attio/callback`,
      response_type: 'code',
      scope: scopes.join(' '),
      state: state,
      prompt: 'consent'  // Force the consent screen to show
    }).toString();

    console.log('Generated auth URL:', authUrl.replace(ATTIO_CLIENT_ID, '********'));

    return NextResponse.json({ url: authUrl, state });
  } catch (error: any) {
    console.error('Error in Attio auth:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 