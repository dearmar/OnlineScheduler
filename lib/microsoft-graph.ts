// Microsoft Graph API integration for Outlook Calendar - Multi-tenant version
import { Client } from '@microsoft/microsoft-graph-client';
import { MicrosoftTokens, OutlookEvent } from './types';
import { sql } from './db/client';

// Map IANA timezone to Windows timezone for Microsoft Graph API
const ianaToWindowsTimezone: Record<string, string> = {
  'America/New_York': 'Eastern Standard Time',
  'America/Chicago': 'Central Standard Time',
  'America/Denver': 'Mountain Standard Time',
  'America/Los_Angeles': 'Pacific Standard Time',
  'America/Anchorage': 'Alaskan Standard Time',
  'Pacific/Honolulu': 'Hawaiian Standard Time',
  'America/Phoenix': 'US Mountain Standard Time',
  'America/Indiana/Indianapolis': 'US Eastern Standard Time',
  'America/Detroit': 'Eastern Standard Time',
  'America/Toronto': 'Eastern Standard Time',
  'America/Vancouver': 'Pacific Standard Time',
  'Europe/London': 'GMT Standard Time',
  'Europe/Paris': 'Romance Standard Time',
  'Europe/Berlin': 'W. Europe Standard Time',
  'Europe/Amsterdam': 'W. Europe Standard Time',
  'Europe/Rome': 'W. Europe Standard Time',
  'Europe/Madrid': 'Romance Standard Time',
  'Europe/Moscow': 'Russian Standard Time',
  'Asia/Tokyo': 'Tokyo Standard Time',
  'Asia/Shanghai': 'China Standard Time',
  'Asia/Hong_Kong': 'China Standard Time',
  'Asia/Singapore': 'Singapore Standard Time',
  'Asia/Dubai': 'Arabian Standard Time',
  'Asia/Kolkata': 'India Standard Time',
  'Australia/Sydney': 'AUS Eastern Standard Time',
  'Australia/Melbourne': 'AUS Eastern Standard Time',
  'Australia/Perth': 'W. Australia Standard Time',
  'Pacific/Auckland': 'New Zealand Standard Time',
  'UTC': 'UTC',
};

export function getWindowsTimezone(ianaTimezone: string): string {
  return ianaToWindowsTimezone[ianaTimezone] || ianaTimezone;
}

// Required scopes for calendar and email access
const SCOPES = [
  'User.Read',
  'Calendars.ReadWrite',
  'Mail.Send',
  'offline_access',
];

// Generate OAuth authorization URL
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: SCOPES.join(' '),
    response_mode: 'query',
    state,
    prompt: 'consent',
  });

  return `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/authorize?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string, userId: string): Promise<MicrosoftTokens> {
  console.log(`[Graph] exchangeCodeForTokens called for user ${userId}`);
  
  const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'authorization_code',
    scope: SCOPES.join(' '),
  });

  console.log(`[Graph] Requesting tokens from ${tokenUrl}`);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error(`[Graph] Token exchange failed:`, data);
    throw new Error(data.error_description || data.error || 'Failed to exchange code for tokens');
  }
  
  console.log(`[Graph] Token exchange successful, has refresh_token: ${!!data.refresh_token}`);

  const tokens: MicrosoftTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
  };

  if (!tokens.refreshToken) {
    console.warn(`[Graph] WARNING: No refresh token received! User may need to re-consent with offline_access scope`);
  }

  // Store tokens for user
  await storeTokens(userId, tokens);
  
  console.log(`[Graph] Tokens stored for user ${userId}, refresh_token length: ${tokens.refreshToken.length}`);

  return tokens;
}

// Refresh access token for user
export async function refreshAccessToken(userId: string): Promise<MicrosoftTokens | null> {
  console.log(`[Graph] refreshAccessToken called for user ${userId}`);
  
  const storedTokens = await getStoredTokens(userId);
  
  if (!storedTokens) {
    console.log(`[Graph] No stored tokens found for user ${userId}`);
    return null;
  }
  
  if (!storedTokens.refreshToken) {
    console.log(`[Graph] No refresh token available for user ${userId} - refresh token is empty`);
    // Clear invalid tokens
    await clearTokens(userId);
    return null;
  }
  
  console.log(`[Graph] Refresh token exists (length: ${storedTokens.refreshToken.length}), attempting refresh...`);

  try {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: storedTokens.refreshToken,
      grant_type: 'refresh_token',
      scope: SCOPES.join(' '),
    });

    console.log(`[Graph] Calling token refresh endpoint`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[Graph] Token refresh failed:`, data.error, data.error_description);
      
      // Clear tokens if refresh fails permanently
      if (data.error === 'invalid_grant' || data.error === 'invalid_client') {
        console.log(`[Graph] Clearing invalid tokens for user ${userId} - re-authentication required`);
        await clearTokens(userId);
      }
      return null;
    }

    console.log(`[Graph] Token refresh successful, new expiry in ${data.expires_in} seconds`);

    const tokens: MicrosoftTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || storedTokens.refreshToken, // Microsoft may or may not return a new refresh token
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope,
    };

    await storeTokens(userId, tokens);
    console.log(`[Graph] Refreshed tokens stored for user ${userId}`);

    return tokens;
  } catch (error: any) {
    console.error(`[Graph] Token refresh error for user ${userId}:`, error.message || error);
    return null;
  }
}

// Store tokens in database for user
async function storeTokens(userId: string, tokens: MicrosoftTokens): Promise<void> {
  console.log(`[Graph] storeTokens for user ${userId}, expires_at: ${tokens.expiresAt}`);
  
  await sql`
    INSERT INTO microsoft_tokens (user_id, access_token, refresh_token, expires_at, scope)
    VALUES (${userId}::uuid, ${tokens.accessToken}, ${tokens.refreshToken}, ${tokens.expiresAt}, ${tokens.scope})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      scope = EXCLUDED.scope,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  console.log(`[Graph] Tokens stored successfully for user ${userId}`);
}

// Get stored tokens from database for user
export async function getStoredTokens(userId: string): Promise<MicrosoftTokens | null> {
  console.log(`[Graph] getStoredTokens for user ${userId}`);
  
  const result = await sql`
    SELECT access_token, refresh_token, expires_at, scope
    FROM microsoft_tokens
    WHERE user_id = ${userId}::uuid
  `;

  if (result.length === 0) {
    console.log(`[Graph] No tokens found for user ${userId}`);
    return null;
  }

  const row = result[0];
  console.log(`[Graph] Found tokens for user ${userId}, expires_at: ${row.expires_at}`);
  
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: Number(row.expires_at),
    scope: row.scope,
  };
}

// Clear tokens for user
export async function clearTokens(userId: string): Promise<void> {
  await sql`DELETE FROM microsoft_tokens WHERE user_id = ${userId}::uuid`;
}

// Get valid access token for user (refreshes if needed)
export async function getValidAccessToken(userId: string): Promise<string | null> {
  let tokens = await getStoredTokens(userId);

  if (!tokens) {
    console.log(`[Graph] getValidAccessToken: No tokens for user ${userId}`);
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  const now = Date.now();
  console.log(`[Graph] Token expires at ${tokens.expiresAt}, now is ${now}, diff: ${tokens.expiresAt - now}ms`);
  
  if (tokens.expiresAt < now + 300000) {
    console.log(`[Graph] Token expired or expiring soon, refreshing...`);
    tokens = await refreshAccessToken(userId);
    if (!tokens) {
      console.log(`[Graph] Token refresh failed for user ${userId}`);
      return null;
    }
    console.log(`[Graph] Token refreshed successfully`);
  }

  return tokens.accessToken;
}

// Check if user is connected to Outlook
export async function isConnected(userId: string): Promise<boolean> {
  console.log(`[Graph] isConnected check for user ${userId}`);
  const tokens = await getStoredTokens(userId);
  const connected = !!tokens?.accessToken;
  console.log(`[Graph] isConnected result: ${connected}`);
  return connected;
}

// Create Microsoft Graph client for user
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Get user profile
export async function getUserProfile(userId: string): Promise<{ email: string; displayName: string } | null> {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    return null;
  }

  try {
    const client = createGraphClient(accessToken);
    const profile = await client.api('/me').get();
    
    return {
      email: profile.mail || profile.userPrincipalName,
      displayName: profile.displayName,
    };
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
}

// Create calendar event
export async function createCalendarEvent(userId: string, event: OutlookEvent): Promise<OutlookEvent | null> {
  console.log(`[Graph] createCalendarEvent called for user ${userId}`);
  
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    console.log(`[Graph] No valid access token for user ${userId}`);
    return null;
  }
  
  console.log(`[Graph] Got valid access token, creating event...`);

  try {
    const client = createGraphClient(accessToken);
    const result = await client.api('/me/events').post(event);
    
    console.log(`[Graph] Event created successfully: ${result.id}`);
    
    return {
      ...event,
      id: result.id,
    };
  } catch (error: any) {
    console.error('[Graph] Failed to create calendar event:', error.message || error);
    if (error.body) {
      console.error('[Graph] Error body:', JSON.stringify(error.body));
    }
    if (error.statusCode) {
      console.error('[Graph] Status code:', error.statusCode);
    }
    return null;
  }
}

// Update calendar event
export async function updateCalendarEvent(userId: string, eventId: string, event: Partial<OutlookEvent>): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    return false;
  }

  try {
    const client = createGraphClient(accessToken);
    await client.api(`/me/events/${eventId}`).patch(event);
    return true;
  } catch (error) {
    console.error('Failed to update calendar event:', error);
    return false;
  }
}

// Delete calendar event
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    return false;
  }

  try {
    const client = createGraphClient(accessToken);
    await client.api(`/me/events/${eventId}`).delete();
    return true;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    return false;
  }
}

// Get free/busy schedule
export async function getFreeBusySchedule(
  userId: string,
  startDate: string,
  endDate: string,
  timezone: string
): Promise<Array<{ start: string; end: string }>> {
  const accessToken = await getValidAccessToken(userId);
  
  if (!accessToken) {
    return [];
  }

  try {
    const client = createGraphClient(accessToken);
    const windowsTimezone = getWindowsTimezone(timezone);
    
    // Get calendar view for the date range
    const events = await client
      .api('/me/calendarView')
      .query({
        startDateTime: `${startDate}T00:00:00`,
        endDateTime: `${endDate}T23:59:59`,
        $select: 'start,end,showAs',
      })
      .header('Prefer', `outlook.timezone="${windowsTimezone}"`)
      .get();

    // Filter to only busy times
    const busyTimes = events.value
      .filter((event: any) => event.showAs === 'busy' || event.showAs === 'tentative')
      .map((event: any) => ({
        start: event.start.dateTime,
        end: event.end.dateTime,
      }));

    return busyTimes;
  } catch (error) {
    console.error('Failed to get free/busy schedule:', error);
    return [];
  }
}

// Get all users with tokens (for token refresh cron job)
export async function getAllUsersWithTokens(): Promise<string[]> {
  const result = await sql`SELECT user_id FROM microsoft_tokens`;
  return result.map(row => row.user_id);
}

// Refresh all tokens (for cron job)
export async function refreshAllTokens(): Promise<{ success: number; failed: number }> {
  const userIds = await getAllUsersWithTokens();
  let success = 0;
  let failed = 0;
  
  for (const userId of userIds) {
    try {
      const tokens = await refreshAccessToken(userId);
      if (tokens) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to refresh token for user ${userId}:`, error);
      failed++;
    }
  }
  
  return { success, failed };
}
