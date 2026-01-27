// GET /api/schedulers - List all public schedulers
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get all users with their config
    const result = await sql`
      SELECT 
        u.id,
        u.name,
        u.slug,
        COALESCE(c.business_name, u.name) as business_name
      FROM admin_users u
      LEFT JOIN scheduler_config c ON c.user_id = u.id
      WHERE u.slug IS NOT NULL
      ORDER BY c.business_name ASC, u.name ASC
    `;
    
    const response = NextResponse.json({
      success: true,
      data: result.map(row => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        businessName: row.business_name,
      })),
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error: any) {
    console.error('Get schedulers error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get schedulers' },
      { status: 500 }
    );
  }
}
