// GET /api/auth/callback - Microsoft OAuth callback

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserProfile } from '@/lib/microsoft-graph';
import { updateConfig } from '@/lib/storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');

    // Handle error from Microsoft
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Verify we have a code
    if (!code) {
      return NextResponse.redirect(
        new URL('/admin?error=No%20authorization%20code%20received', request.url)
      );
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code);

    // Get user profile to store email
    const profile = await getUserProfile();
    const email = profile.mail || profile.userPrincipalName;

    // Update config with Outlook connection
    await updateConfig({
      outlookEmail: email,
      outlookConnected: true,
    });

    console.log('Microsoft OAuth successful for:', email);

    // Redirect back to admin panel
    return NextResponse.redirect(
      new URL('/admin?success=Outlook%20connected%20successfully', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/admin?error=Failed%20to%20connect%20Outlook', request.url)
    );
  }
}
