// GET/PUT /api/config - Scheduler configuration (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { getConfig, updateConfig, getUserBySlugOrId } from '@/lib/storage';
import { isConnected } from '@/lib/microsoft-graph';
import { getAuthenticatedUser } from '@/lib/auth';
import { noCacheResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// GET - Retrieve configuration (public for booking, or admin's own)
export async function GET(request: NextRequest) {
  noStore();
  
  try {
    const userParam = request.nextUrl.searchParams.get('user');
    let userId: string | null = null;
    
    if (userParam) {
      // Public access by slug or ID
      const user = await getUserBySlugOrId(userParam);
      if (!user) {
        return noCacheResponse({ success: false, error: 'User not found' }, 404);
      }
      userId = user.id;
    } else {
      // Admin access - use authenticated user
      const authUser = await getAuthenticatedUser(request);
      if (!authUser) {
        return noCacheResponse({ success: false, error: 'User parameter required or authentication needed' }, 400);
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
    
    return noCacheResponse({ success: true, data: publicConfig });
  } catch (error) {
    console.error('Get config error:', error);
    return noCacheResponse({ success: false, error: 'Failed to retrieve configuration' }, 500);
  }
}

// PUT - Update configuration (requires authentication)
export async function PUT(request: NextRequest) {
  noStore();
  
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return noCacheResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    
    const updates = await request.json();
    
    // Validate updates
    if (updates.startHour !== undefined && (updates.startHour < 0 || updates.startHour > 23)) {
      return noCacheResponse({ success: false, error: 'Invalid start hour' }, 400);
    }
    
    if (updates.endHour !== undefined && (updates.endHour < 1 || updates.endHour > 24)) {
      return noCacheResponse({ success: false, error: 'Invalid end hour' }, 400);
    }
    
    if (updates.startHour !== undefined && updates.endHour !== undefined && updates.startHour >= updates.endHour) {
      return noCacheResponse({ success: false, error: 'Start hour must be before end hour' }, 400);
    }
    
    const newConfig = await updateConfig(authUser.userId, updates);
    
    return noCacheResponse({ success: true, data: newConfig });
  } catch (error: any) {
    console.error('Update config error:', error);
    return noCacheResponse({ success: false, error: error.message || 'Failed to update configuration' }, 500);
  }
}
