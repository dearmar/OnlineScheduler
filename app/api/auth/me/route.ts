// GET /api/auth/me - Get current user info
import { NextRequest } from 'next/server';
import { getAuthenticatedUser, getAdminUserById } from '@/lib/auth';
import { noCacheResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return noCacheResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    
    const user = await getAdminUserById(authUser.userId);
    
    if (!user) {
      return noCacheResponse({ success: false, error: 'User not found' }, 404);
    }
    
    return noCacheResponse({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        slug: user.slug,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return noCacheResponse({ success: false, error: 'Failed to get user info' }, 500);
  }
}
