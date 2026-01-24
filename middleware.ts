import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require authentication
const protectedApiPaths = [
  '/api/auth/change-password',
  '/api/webhooks/subscribe',
];

// Paths that should skip authentication check
const publicPaths = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/verify',
  '/api/auth/callback',
  '/api/auth/microsoft',
  '/api/config',
  '/api/availability',
  '/api/bookings',
  '/api/webhooks/microsoft',
  '/api/cron',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check protected API paths
  if (protectedApiPaths.some(path => pathname.startsWith(path))) {
    const token = request.cookies.get('auth_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Token verification is done in the route handlers
    // This middleware just checks for presence
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
