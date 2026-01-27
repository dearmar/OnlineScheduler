import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getConfig, updateConfig } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth';

// Force dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  
  try {
    // Check authentication for config operations
    const authUser = await getAuthenticatedUser(request);
    
    if (action === 'status') {
      // Test database connection
      const dbTest = await sql`SELECT 1 as test`;
      
      // Get config only if authenticated
      let configInfo = null;
      if (authUser) {
        const config = await getConfig(authUser.userId);
        configInfo = {
          businessName: config.businessName,
          startHour: config.startHour,
          endHour: config.endHour,
          timezone: config.timezone,
          meetingTypesCount: config.meetingTypes?.length || 0,
        };
      }
      
      return NextResponse.json({
        status: 'ok',
        dbConnected: dbTest.length > 0,
        authenticated: !!authUser,
        config: configInfo,
      });
    }
    
    if (action === 'test-update') {
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      
      // Test a simple update
      const testUpdate = { businessName: 'Test Update ' + Date.now() };
      const result = await updateConfig(authUser.userId, testUpdate);
      
      return NextResponse.json({
        status: 'ok',
        updated: true,
        newBusinessName: result.businessName
      });
    }
    
    return NextResponse.json({ error: 'Unknown action' });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const body = await request.json();
    
    console.log('Debug PUT received:', JSON.stringify(body, null, 2));
    
    const result = await updateConfig(authUser.userId, body);
    
    return NextResponse.json({
      status: 'ok',
      result
    });
  } catch (error: any) {
    console.error('Debug PUT error:', error);
    return NextResponse.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    });
  }
}
