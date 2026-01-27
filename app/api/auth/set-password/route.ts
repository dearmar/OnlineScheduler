// POST /api/auth/set-password - Set new password on forced reset
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordOnLogin, getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { currentPassword, newPassword } = await request.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      );
    }
    
    const newToken = await resetPasswordOnLogin(authUser.userId, currentPassword, newPassword);
    
    // Set new token cookie
    const response = NextResponse.json({
      success: true,
      data: { token: newToken },
      message: 'Password updated successfully',
    });
    
    response.cookies.set('auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
    
    return response;
  } catch (error: any) {
    console.error('Set password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to set password' },
      { status: 500 }
    );
  }
}
