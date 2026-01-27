// GET /api/auth/verify - Verify authentication token
import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { noCacheResponse } from '@/lib/api-helpers';

// Force dynamic
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check for token in cookie or Authorization header
    const cookieToken = request.cookies.get('auth_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return noCacheResponse({ success: false, error: 'No token provided' }, 401);
    }
    
    const payload = verifyToken(token);
    
    if (!payload) {
      return noCacheResponse({ success: false, error: 'Invalid or expired token' }, 401);
    }
    
    return noCacheResponse({
      success: true,
      data: {
        userId: payload.userId,
        email: payload.email,
      },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return noCacheResponse({ success: false, error: 'Verification failed' }, 500);
  }
}
