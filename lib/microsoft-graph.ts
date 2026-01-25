// Microsoft Graph API integration for Outlook Calendar
import { ConfidentialClientApplication, AuthorizationCodeRequest, RefreshTokenRequest } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { MicrosoftTokens, OutlookEvent } from './types';
import { sql } from './db/client';

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
  },
};

// Required scopes for calendar and email access
const SCOPES = [
  'User.Read',
  'Calendars.ReadWrite',
  'Mail.Send',
  'offline_access',
];

// Create MSAL client
let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return msalClient;
}

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
export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const client = getMsalClient();
  
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI!,
  };

  const response = await client.acquireTokenByCode(tokenRequest);
  
  if (!response) {
    throw new Error('Failed to acquire token');
  }

  const tokens: MicrosoftTokens = {
    accessToken: response.accessToken,
    refreshToken: (response as any).refreshToken || '',
    expiresAt: response.expiresOn?.getTime() || Date.now() + 3600000,
    scope: response.scopes.join(' '),
  };

  // Store tokens securely
  await storeTokens(tokens);

  return tokens;
}

// Refresh access token
export async function refreshAccessToken(): Promise<MicrosoftTokens | null> {
  const storedTokens = await getStoredTokens();
  
  if (!storedTokens?.refreshToken) {
    return null;
  }

  const client = getMsalClient();
  
  const refreshRequest: RefreshTokenRequest = {
    refreshToken: storedTokens.refreshToken,
    scopes: SCOPES,
  };

  try {
    const response = await client.acquireTokenByRefreshToken(refreshRequest);
    
    if (!response) {
      return null;
    }

    const tokens: MicrosoftTokens = {
      accessToken: response.accessToken,
      refreshToken: (response as any).refreshToken || storedTokens.refreshToken,
      expiresAt: response.expiresOn?.getTime() || Date.now() + 3600000,
      scope: response.scopes.join(' '),
    };

    await storeTokens(tokens);
    return tokens;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
}

// Get valid access token (refresh if needed)
export async function getValidAccessToken(): Promise<string | null> {
  let tokens = await getStoredTokens();
  
  if (!tokens) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  if (Date.now() > tokens.expiresAt - 300000) {
    tokens = await refreshAccessToken();
    if (!tokens) {
      return null;
    }
  }

  return tokens.accessToken;
}

// Store tokens in Neon PostgreSQL
async function storeTokens(tokens: MicrosoftTokens): Promise<void> {
  await sql`
    INSERT INTO microsoft_tokens (id, access_token, refresh_token, expires_at, scope)
    VALUES (1, ${tokens.accessToken}, ${tokens.refreshToken}, ${tokens.expiresAt}, ${tokens.scope})
    ON CONFLICT (id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      scope = EXCLUDED.scope,
      updated_at = CURRENT_TIMESTAMP
  `;
}

// Get stored tokens from Neon PostgreSQL
export async function getStoredTokens(): Promise<MicrosoftTokens | null> {
  const result = await sql`
    SELECT access_token, refresh_token, expires_at, scope
    FROM microsoft_tokens
    WHERE id = 1
  `;
  
  if (result.length === 0) return null;
  
  return {
    accessToken: result[0].access_token,
    refreshToken: result[0].refresh_token,
    expiresAt: parseInt(result[0].expires_at),
    scope: result[0].scope,
  };
}

// Clear stored tokens
export async function clearTokens(): Promise<void> {
  await sql`DELETE FROM microsoft_tokens WHERE id = 1`;
}

// Create Microsoft Graph client
export async function getGraphClient(): Promise<Client | null> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    return null;
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// Get user profile
export async function getUserProfile(): Promise<any> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  return client.api('/me').select('displayName,mail,userPrincipalName').get();
}

// Create calendar event
export async function createCalendarEvent(event: OutlookEvent): Promise<OutlookEvent> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  const createdEvent = await client.api('/me/calendar/events').post(event);
  return createdEvent;
}

// Update calendar event
export async function updateCalendarEvent(eventId: string, event: Partial<OutlookEvent>): Promise<OutlookEvent> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  const updatedEvent = await client.api(`/me/calendar/events/${eventId}`).patch(event);
  return updatedEvent;
}

// Delete calendar event
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  await client.api(`/me/calendar/events/${eventId}`).delete();
}

// Get calendar events for a date range
export async function getCalendarEvents(startDate: string, endDate: string): Promise<OutlookEvent[]> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  const response = await client
    .api('/me/calendar/calendarView')
    .query({
      startDateTime: startDate,
      endDateTime: endDate,
    })
    .select('id,subject,start,end,isCancelled')
    .orderby('start/dateTime')
    .get();

  return response.value;
}

// Get busy times for a date range
export async function getFreeBusySchedule(startDate: string, endDate: string, timezone: string): Promise<any> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  const userProfile = await getUserProfile();
  
  const response = await client.api('/me/calendar/getSchedule').post({
    schedules: [userProfile.mail || userProfile.userPrincipalName],
    startTime: {
      dateTime: startDate,
      timeZone: timezone,
    },
    endTime: {
      dateTime: endDate,
      timeZone: timezone,
    },
    availabilityViewInterval: 15,
  });

  return response.value[0];
}

// Send email via Graph API
export async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string,
  toName?: string
): Promise<void> {
  const client = await getGraphClient();
  
  if (!client) {
    throw new Error('Not authenticated with Microsoft');
  }

  const message = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlContent,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
            name: toName || to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  await client.api('/me/sendMail').post(message);
}

// Check if connected to Microsoft
export async function isConnected(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return !!tokens?.accessToken;
}
