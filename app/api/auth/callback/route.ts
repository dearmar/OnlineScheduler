// GET /api/auth/callback - Microsoft OAuth callback (multi-tenant)

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserProfile } from '@/lib/microsoft-graph';
import { updateConfig } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log(`[Callback] OAuth callback received - code: ${code ? 'yes' : 'no'}, state: ${state ? 'yes' : 'no'}, error: ${error || 'none'}`);

    if (error) {
      console.error('[Callback] OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent(errorDescription || error)}`, request.url)
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
      console.log(`[Callback] Decoded state - userId: ${userId}`);
      if (!userId) {
        throw new Error('No userId in state');
      }
    } catch (e) {
      console.error('[Callback] Failed to decode state:', e);
      return NextResponse.redirect(
        new URL('/admin?error=Invalid state parameter', request.url)
      );
    }

    // Exchange code for tokens (stores them for user)
    console.log(`[Callback] Exchanging code for tokens for user ${userId}`);
    await exchangeCodeForTokens(code, userId);
    console.log(`[Callback] Tokens exchanged successfully`);
    
    // Get user profile to update config
    const profile = await getUserProfile(userId);
    console.log(`[Callback] Got profile:`, profile ? profile.email : 'null');
    
    if (profile) {
      await updateConfig(userId, {
        outlookEmail: profile.email,
        outlookConnected: true,
      });
      console.log(`[Callback] Updated config with Outlook email`);
    }

    return NextResponse.redirect(
      new URL('/admin?success=Successfully connected to Microsoft Outlook!', request.url)
    );
  } catch (error: any) {
    console.error('[Callback] Callback error:', error);
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent(error.message || 'Failed to complete authentication')}`, request.url)
    );
  }
}
