// GET/PUT /api/config - Scheduler configuration (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig, getUserBySlugOrId } from '@/lib/storage';
import { isConnected } from '@/lib/microsoft-graph';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Retrieve configuration (public for booking, or admin's own)
export async function GET(request: NextRequest) {
  try {
    const userParam = request.nextUrl.searchParams.get('user');
    let userId: string | null = null;
    
    if (userParam) {
      // Public access by slug or ID
      const user = await getUserBySlugOrId(userParam);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }
      userId = user.id;
    } else {
      // Admin access - use authenticated user
      const authUser = await getAuthenticatedUser(request);
      if (!authUser) {
        return NextResponse.json(
          { success: false, error: 'User parameter required or authentication needed' },
          { status: 400 }
        );
      }
      userId = authUser.userId;
    }
    
    const config = await getConfig(userId);
    const outlookConnected = await isConnected(userId);
    
    const publicConfig = {
      businessName: config.businessName,
      logo: config.logo,
      primaryColor: config.primaryColor,
      accentColor: config.accentColor,
      startHour: config.startHour,
      endHour: config.endHour,
      timezone: config.timezone,
      meetingTypes: config.meetingTypes,
      outlookConnected,
    };
    
    const response = NextResponse.json({
      success: true,
      data: publicConfig,
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}

// PUT - Update configuration (requires authentication)
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const updates = await request.json();
    
    // Validate updates
    if (updates.startHour !== undefined && (updates.startHour < 0 || updates.startHour > 23)) {
      return NextResponse.json(
        { success: false, error: 'Invalid start hour' },
        { status: 400 }
      );
    }
    
    if (updates.endHour !== undefined && (updates.endHour < 1 || updates.endHour > 24)) {
      return NextResponse.json(
        { success: false, error: 'Invalid end hour' },
        { status: 400 }
      );
    }
    
    if (updates.startHour !== undefined && updates.endHour !== undefined && updates.startHour >= updates.endHour) {
      return NextResponse.json(
        { success: false, error: 'Start hour must be before end hour' },
        { status: 400 }
      );
    }
    
    const newConfig = await updateConfig(authUser.userId, updates);
    
    return NextResponse.json({
      success: true,
      data: newConfig,
    });
  } catch (error: any) {
    console.error('Update config error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
