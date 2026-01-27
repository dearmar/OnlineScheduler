// POST /api/auth/google/disconnect - Disconnect Google Calendar
import { NextRequest, NextResponse } from 'next/server';
import { clearGoogleTokens } from '@/lib/google-calendar';
import { updateConfig } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth';

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

    // Clear tokens
    await clearGoogleTokens(authUser.userId);
    
    // Update config
    await updateConfig(authUser.userId, {
      googleEmail: '',
      googleConnected: false,
      calendarProvider: 'none',
    });

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected',
    });
  } catch (error: any) {
    console.error('Google disconnect error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
