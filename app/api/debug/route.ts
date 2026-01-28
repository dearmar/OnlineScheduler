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
    
    if (action === 'tokens') {
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      
      // Check token status in database
      const tokens = await sql`
        SELECT 
          user_id,
          LENGTH(access_token) as access_token_length,
          LENGTH(refresh_token) as refresh_token_length,
          expires_at,
          scope,
          updated_at
        FROM microsoft_tokens 
        WHERE user_id = ${authUser.userId}
      `;
      
      if (tokens.length === 0) {
        return NextResponse.json({
          status: 'no_tokens',
          userId: authUser.userId,
          message: 'No Microsoft tokens found for this user'
        });
      }
      
      const token = tokens[0];
      const now = Date.now();
      const expiresAt = Number(token.expires_at);
      
      return NextResponse.json({
        status: 'ok',
        userId: authUser.userId,
        accessTokenLength: token.access_token_length,
        refreshTokenLength: token.refresh_token_length,
        hasRefreshToken: token.refresh_token_length > 0,
        expiresAt: new Date(expiresAt).toISOString(),
        isExpired: now > expiresAt,
        expiresInMinutes: Math.round((expiresAt - now) / 60000),
        scope: token.scope,
        updatedAt: token.updated_at
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
    
    if (action === 'calendar') {
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      
      // Check all calendar-related settings
      const config = await getConfig(authUser.userId);
      
      // Check Microsoft tokens
      const msTokens = await sql`
        SELECT 
          LENGTH(access_token) as access_token_length,
          LENGTH(refresh_token) as refresh_token_length,
          expires_at,
          updated_at
        FROM microsoft_tokens 
        WHERE user_id = ${authUser.userId}::uuid
      `;
      
      // Check Google tokens
      const googleTokens = await sql`
        SELECT 
          LENGTH(access_token) as access_token_length,
          LENGTH(refresh_token) as refresh_token_length,
          expires_at,
          updated_at
        FROM google_tokens 
        WHERE user_id = ${authUser.userId}::uuid
      `;
      
      const now = Date.now();
      
      return NextResponse.json({
        status: 'ok',
        userId: authUser.userId,
        calendarProvider: config.calendarProvider,
        outlookEmail: config.outlookEmail,
        outlookConnectedFlag: config.outlookConnected,
        googleEmail: config.googleEmail,
        googleConnectedFlag: config.googleConnected,
        microsoftTokens: msTokens.length > 0 ? {
          hasTokens: true,
          accessTokenLength: msTokens[0].access_token_length,
          refreshTokenLength: msTokens[0].refresh_token_length,
          expiresAt: new Date(Number(msTokens[0].expires_at)).toISOString(),
          isExpired: now > Number(msTokens[0].expires_at),
          updatedAt: msTokens[0].updated_at
        } : { hasTokens: false },
        googleTokens: googleTokens.length > 0 ? {
          hasTokens: true,
          accessTokenLength: googleTokens[0].access_token_length,
          refreshTokenLength: googleTokens[0].refresh_token_length,
          expiresAt: new Date(Number(googleTokens[0].expires_at)).toISOString(),
          isExpired: now > Number(googleTokens[0].expires_at),
          updatedAt: googleTokens[0].updated_at
        } : { hasTokens: false },
        envVars: {
          ENABLE_CALENDAR_SYNC: process.env.ENABLE_CALENDAR_SYNC,
          hasOutlookClientId: !!process.env.MICROSOFT_CLIENT_ID,
          hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        }
      });
    }
    
    return NextResponse.json({ error: 'Unknown action. Use action=status, action=tokens, action=calendar, or action=test-update' });
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
