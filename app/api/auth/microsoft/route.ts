// GET /api/auth/microsoft - Initiate Microsoft OAuth (multi-tenant)

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/microsoft-graph';
import { getAuthenticatedUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    // Must be authenticated to connect Outlook
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Generate state that includes user ID for callback
    const state = JSON.stringify({
      nonce: uuidv4(),
      userId: authUser.userId,
    });
    
    const encodedState = Buffer.from(state).toString('base64');
    const authUrl = getAuthorizationUrl(encodedState);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft auth error:', error);
    return NextResponse.redirect(
      new URL('/admin?error=Failed to initiate Microsoft login', request.url)
    );
  }
}
