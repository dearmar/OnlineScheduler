// GET /api/auth/google - Initiate Google OAuth
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthorizationUrl } from '@/lib/google-calendar';
import { getAuthenticatedUser } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Must be authenticated to connect Google
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
      provider: 'google',
    });
    
    const encodedState = Buffer.from(state).toString('base64');
    const authUrl = getGoogleAuthorizationUrl(encodedState);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.redirect(
      new URL('/admin?error=Failed to initiate Google login', request.url)
    );
  }
}
