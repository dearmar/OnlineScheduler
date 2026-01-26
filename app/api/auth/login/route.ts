import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const { password } = await request.json();
  
  // Get the stored hash
  const result = await sql`SELECT email, password_hash FROM admin_users LIMIT 1`;
  
  if (result.length === 0) {
    return NextResponse.json({ error: 'No admin user found' });
  }
  
  const storedHash = result[0].password_hash;
  
  // Test the password
  const isValid = await bcrypt.compare(password, storedHash);
  
  // Generate a new hash for comparison
  const newHash = await bcrypt.hash(password, 12);
  
  return NextResponse.json({
    email: result[0].email,
    storedHashPrefix: storedHash?.substring(0, 30),
    passwordTested: password,
    isValid,
    newHashForThisPassword: newHash
  });
}

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
