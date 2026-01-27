import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { getConfig, updateConfig } from '@/lib/storage';

// Force dynamic
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  
  try {
    if (action === 'status') {
      // Test database connection
      const dbTest = await sql`SELECT 1 as test`;
      
      // Get current config
      const config = await getConfig();
      
      return NextResponse.json({
        status: 'ok',
        dbConnected: dbTest.length > 0,
        configLoaded: !!config,
        meetingTypesCount: config.meetingTypes?.length || 0,
        config: {
          businessName: config.businessName,
          startHour: config.startHour,
          endHour: config.endHour,
          timezone: config.timezone,
        }
      });
    }
    
    if (action === 'test-update') {
      // Test a simple update
      const testUpdate = { businessName: 'Test Update ' + Date.now() };
      const result = await updateConfig(testUpdate);
      
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
    const body = await request.json();
    
    console.log('Debug PUT received:', JSON.stringify(body, null, 2));
    
    const result = await updateConfig(body);
    
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
