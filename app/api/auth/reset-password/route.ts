// POST /api/auth/reset-password - Reset password with token
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    
    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Token and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    await resetPasswordWithToken(token, newPassword);
    
    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
