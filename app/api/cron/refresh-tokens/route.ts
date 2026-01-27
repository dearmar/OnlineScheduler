// GET /api/cron/refresh-tokens - Refresh all Microsoft tokens

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { refreshAllTokens } from '@/lib/microsoft-graph';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    if (process.env.CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const result = await refreshAllTokens();

    return NextResponse.json({
      success: true,
      message: `Token refresh complete. Success: ${result.success}, Failed: ${result.failed}`,
      data: result,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to refresh tokens' },
      { status: 500 }
    );
  }
}
