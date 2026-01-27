// Google Calendar API integration
import { GoogleTokens, GoogleCalendarEvent } from './types';
import { sql } from './db/client';

// Required scopes for Google Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Generate OAuth authorization URL
export function getGoogleAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeGoogleCodeForTokens(code: string, userId: string): Promise<GoogleTokens> {
  console.log(`[Google] exchangeCodeForTokens called for user ${userId}`);
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: 'authorization_code',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error(`[Google] Token exchange failed:`, data);
    throw new Error(data.error_description || data.error || 'Failed to exchange code for tokens');
  }
  
  console.log(`[Google] Token exchange successful, has refresh_token: ${!!data.refresh_token}`);

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + (data.expires_in * 1000),
    scope: data.scope,
  };

  if (!tokens.refreshToken) {
    console.warn(`[Google] WARNING: No refresh token received!`);
  }

  await storeGoogleTokens(userId, tokens);
  
  return tokens;
}

// Refresh access token
export async function refreshGoogleAccessToken(userId: string): Promise<GoogleTokens | null> {
  console.log(`[Google] refreshAccessToken called for user ${userId}`);
  
  const storedTokens = await getStoredGoogleTokens(userId);
  
  if (!storedTokens || !storedTokens.refreshToken) {
    console.log(`[Google] No refresh token available for user ${userId}`);
    return null;
  }

  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: storedTokens.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[Google] Token refresh failed:`, data.error, data.error_description);
      if (data.error === 'invalid_grant') {
        await clearGoogleTokens(userId);
      }
      return null;
    }

    console.log(`[Google] Token refresh successful`);

    const tokens: GoogleTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || storedTokens.refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
      scope: data.scope || storedTokens.scope,
    };

    await storeGoogleTokens(userId, tokens);
    return tokens;
  } catch (error: any) {
    console.error(`[Google] Token refresh error:`, error.message);
    return null;
  }
}

// Store tokens in database
async function storeGoogleTokens(userId: string, tokens: GoogleTokens): Promise<void> {
  await sql`
    INSERT INTO google_tokens (user_id, access_token, refresh_token, expires_at, scope)
    VALUES (${userId}::uuid, ${tokens.accessToken}, ${tokens.refreshToken}, ${tokens.expiresAt}, ${tokens.scope})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      scope = EXCLUDED.scope,
      updated_at = CURRENT_TIMESTAMP
  `;
}

// Get stored tokens
export async function getStoredGoogleTokens(userId: string): Promise<GoogleTokens | null> {
  const result = await sql`
    SELECT access_token, refresh_token, expires_at, scope
    FROM google_tokens
    WHERE user_id = ${userId}::uuid
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: Number(row.expires_at),
    scope: row.scope,
  };
}

// Clear tokens
export async function clearGoogleTokens(userId: string): Promise<void> {
  await sql`DELETE FROM google_tokens WHERE user_id = ${userId}::uuid`;
}

// Get valid access token
export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  let tokens = await getStoredGoogleTokens(userId);

  if (!tokens) {
    return null;
  }

  // Check if token is expired or about to expire (5 min buffer)
  if (tokens.expiresAt < Date.now() + 300000) {
    tokens = await refreshGoogleAccessToken(userId);
    if (!tokens) {
      return null;
    }
  }

  return tokens.accessToken;
}

// Check if user is connected to Google
export async function isGoogleConnected(userId: string): Promise<boolean> {
  const tokens = await getStoredGoogleTokens(userId);
  return !!tokens?.accessToken;
}

// Get user profile
export async function getGoogleUserProfile(userId: string): Promise<{ email: string; name: string } | null> {
  const accessToken = await getValidGoogleAccessToken(userId);
  
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      console.error('[Google] Failed to get user profile');
      return null;
    }
    
    const data = await response.json();
    return {
      email: data.email,
      name: data.name,
    };
  } catch (error) {
    console.error('[Google] Error getting user profile:', error);
    return null;
  }
}

// Create calendar event
export async function createGoogleCalendarEvent(userId: string, event: GoogleCalendarEvent): Promise<GoogleCalendarEvent | null> {
  const accessToken = await getValidGoogleAccessToken(userId);
  
  if (!accessToken) {
    console.log(`[Google] No valid access token for user ${userId}`);
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[Google] Failed to create calendar event:', error);
      return null;
    }
    
    const result = await response.json();
    console.log(`[Google] Event created successfully: ${result.id}`);
    
    return {
      ...event,
      id: result.id,
    };
  } catch (error) {
    console.error('[Google] Error creating calendar event:', error);
    return null;
  }
}

// Update calendar event
export async function updateGoogleCalendarEvent(userId: string, eventId: string, event: Partial<GoogleCalendarEvent>): Promise<boolean> {
  const accessToken = await getValidGoogleAccessToken(userId);
  
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Google] Error updating calendar event:', error);
    return false;
  }
}

// Delete calendar event
export async function deleteGoogleCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const accessToken = await getValidGoogleAccessToken(userId);
  
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    return response.ok || response.status === 404;
  } catch (error) {
    console.error('[Google] Error deleting calendar event:', error);
    return false;
  }
}

// Get free/busy schedule for availability
export async function getGoogleFreeBusySchedule(
  userId: string,
  startDate: string,
  endDate: string,
  timezone: string
): Promise<Array<{ start: string; end: string }> | null> {
  const accessToken = await getValidGoogleAccessToken(userId);
  
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: `${startDate}T00:00:00`,
        timeMax: `${endDate}T23:59:59`,
        timeZone: timezone,
        items: [{ id: 'primary' }],
      }),
    });
    
    if (!response.ok) {
      console.error('[Google] Failed to get free/busy schedule');
      return null;
    }
    
    const data = await response.json();
    const busySlots = data.calendars?.primary?.busy || [];
    
    return busySlots.map((slot: any) => ({
      start: slot.start,
      end: slot.end,
    }));
  } catch (error) {
    console.error('[Google] Error getting free/busy schedule:', error);
    return null;
  }
}
