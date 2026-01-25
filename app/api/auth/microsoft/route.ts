// GET /api/auth/microsoft - Initiate Microsoft OAuth
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/microsoft-graph';
import { isAuthenticated } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    // Verify admin is authenticated
    // Note: In production, you might want to check cookie-based auth here
    
    // Generate state parameter for CSRF protection
    const state = uuidv4();
    
    // Get authorization URL
    const authUrl = getAuthorizationUrl(state);
    
    // Store state in cookie for verification
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Microsoft OAuth initiation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate Microsoft authentication' },
      { status: 500 }
    );
  }
}
