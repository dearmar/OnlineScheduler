// POST /api/auth/login - Admin login
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdmin, ensureAdminUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Ensure admin user exists
    await ensureAdminUser();
    
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    const result = await authenticateAdmin(email, password);
    
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Set HTTP-only cookie for token
    const response = NextResponse.json({
      success: true,
      data: {
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
        },
      },
    });
    
    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
