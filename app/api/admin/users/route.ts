// GET/POST /api/admin/users - Admin user management
import { NextRequest, NextResponse } from 'next/server';
import { getAllAdminUsers, createAdminUser, getAuthenticatedUser } from '@/lib/auth';
import { sendNewUserEmail } from '@/lib/email';
import { getConfig } from '@/lib/storage';
import { noCacheResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - List all admin users
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return noCacheResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    
    const users = await getAllAdminUsers();
    
    return noCacheResponse({
      success: true,
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        slug: u.slug,
        mustResetPassword: u.mustResetPassword,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
      })),
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    return noCacheResponse({ success: false, error: error.message || 'Failed to get users' }, 500);
  }
}

// POST - Create new admin user
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return noCacheResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    
    const { email, name } = await request.json();
    
    if (!email || !name) {
      return noCacheResponse({ success: false, error: 'Email and name are required' }, 400);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return noCacheResponse({ success: false, error: 'Invalid email format' }, 400);
    }
    
    // Create user with temp password
    const { user, tempPassword } = await createAdminUser(email, name, authUser.userId);
    
    // Send welcome email with temp password (use creator's config for branding)
    try {
      const config = await getConfig(authUser.userId);
      await sendNewUserEmail(email, name, tempPassword, config);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue - user is created, they can use forgot password if needed
    }
    
    return noCacheResponse({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        slug: user.slug,
        tempPassword, // Return temp password so admin can share it if email fails
      },
      message: 'User created successfully. Temporary password has been sent via email.',
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return noCacheResponse({ success: false, error: error.message || 'Failed to create user' }, 500);
  }
}
