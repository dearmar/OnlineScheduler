// GET /api/cron/refresh-tokens - Cron job to refresh Microsoft tokens
import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, getStoredTokens } from '@/lib/microsoft-graph';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const tokens = await getStoredTokens();
    
    if (!tokens) {
      return NextResponse.json({
        success: true,
        message: 'No tokens to refresh',
      });
    }

    // Check if token expires within 24 hours
    const expiresIn = tokens.expiresAt - Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (expiresIn < twentyFourHours) {
      await refreshAccessToken();
      return NextResponse.json({
        success: true,
        message: 'Token refreshed successfully',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token still valid',
      expiresIn: Math.round(expiresIn / 1000 / 60 / 60) + ' hours',
    });
  } catch (error) {
    console.error('Token refresh cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
