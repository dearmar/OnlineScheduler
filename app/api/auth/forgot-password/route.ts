// POST /api/auth/forgot-password - Request password reset
import { NextRequest, NextResponse } from 'next/server';
import { setPasswordResetToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { getConfig } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Always return success to prevent email enumeration
    const result = await setPasswordResetToken(email);
    
    if (result) {
      try {
        const config = await getConfig();
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/admin?reset=${result.resetToken}`;
        await sendPasswordResetEmail(result.user.email, result.user.name || 'Admin', resetUrl, config);
      } catch (emailError) {
        console.error('Failed to send reset email:', emailError);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
