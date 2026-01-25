// POST /api/auth/microsoft/disconnect - Disconnect Microsoft account
import { NextRequest, NextResponse } from 'next/server';
import { clearTokens } from '@/lib/microsoft-graph';
import { updateConfig } from '@/lib/storage';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin is authenticated
    // const authenticated = await isAuthenticated(request);
    // if (!authenticated) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    // Clear stored tokens
    await clearTokens();
    
    // Update config
    await updateConfig({
      outlookEmail: '',
      outlookConnected: false,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Microsoft account disconnected',
    });
  } catch (error) {
    console.error('Microsoft disconnect error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Microsoft account' },
      { status: 500 }
    );
  }
}
