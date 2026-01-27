// GET /api/auth/google/callback - Google OAuth callback
import { NextRequest, NextResponse } from 'next/server';
import { exchangeGoogleCodeForTokens, getGoogleUserProfile } from '@/lib/google-calendar';
import { updateConfig } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log(`[Google Callback] Received - code: ${code ? 'yes' : 'no'}, error: ${error || 'none'}`);

    if (error) {
      console.error('[Google Callback] OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin?error=No authorization code received', request.url)
      );
    }

    if (!state) {
      return NextResponse.redirect(
        new URL('/admin?error=No state received', request.url)
      );
    }
    
    // Decode state to get userId
    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = decodedState.userId;
      console.log(`[Google Callback] Decoded state - userId: ${userId}`);
      if (!userId) {
        throw new Error('No userId in state');
      }
    } catch (e) {
      console.error('[Google Callback] Failed to decode state:', e);
      return NextResponse.redirect(
        new URL('/admin?error=Invalid state parameter', request.url)
      );
    }

    // Exchange code for tokens
    console.log(`[Google Callback] Exchanging code for tokens for user ${userId}`);
    await exchangeGoogleCodeForTokens(code, userId);
    console.log(`[Google Callback] Tokens exchanged successfully`);
    
    // Get user profile to update config
    const profile = await getGoogleUserProfile(userId);
    console.log(`[Google Callback] Got profile:`, profile ? profile.email : 'null');
    
    if (profile) {
      await updateConfig(userId, {
        googleEmail: profile.email,
        googleConnected: true,
        calendarProvider: 'google',
      });
      console.log(`[Google Callback] Updated config with Google email`);
    }

    return NextResponse.redirect(
      new URL('/admin?success=Successfully connected to Google Calendar!', request.url)
    );
  } catch (error: any) {
    console.error('[Google Callback] Error:', error);
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent(error.message || 'Failed to complete authentication')}`, request.url)
    );
  }
}
