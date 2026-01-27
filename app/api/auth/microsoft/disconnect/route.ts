// POST /api/auth/microsoft/disconnect - Disconnect Microsoft account (multi-tenant)

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { clearTokens } from '@/lib/microsoft-graph';
import { updateConfig } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Clear tokens for user
    await clearTokens(authUser.userId);
    
    // Update config
    await updateConfig(authUser.userId, {
      outlookEmail: '',
      outlookConnected: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Microsoft account disconnected',
    });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Microsoft account' },
      { status: 500 }
    );
  }
}
