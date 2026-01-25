// Webhook service for external integrations
import crypto from 'crypto';
import { BookedSlot, SchedulerConfig, WebhookPayload } from './types';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const EXTERNAL_WEBHOOK_URL = process.env.EXTERNAL_WEBHOOK_URL;

// Generate HMAC signature for webhook payload
export function generateSignature(payload: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

// Verify incoming webhook signature
export function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = generateSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Send webhook to external service
export async function sendWebhook(
  event: WebhookPayload['event'],
  booking: BookedSlot,
  config: Partial<SchedulerConfig>
): Promise<void> {
  if (process.env.ENABLE_WEBHOOKS !== 'true' || !EXTERNAL_WEBHOOK_URL) {
    console.log('Webhooks disabled or no external URL configured');
    return;
  }

  const payload: WebhookPayload = {
    event,
    data: {
      booking,
      config: {
        businessName: config.businessName,
        timezone: config.timezone,
      },
    },
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString);

  try {
    const response = await fetch(EXTERNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body: payloadString,
    });

    if (!response.ok) {
      console.error(`Webhook failed with status ${response.status}`);
    } else {
      console.log(`Webhook sent successfully: ${event}`);
    }
  } catch (error) {
    console.error('Failed to send webhook:', error);
  }
}

// Send booking created webhook
export async function sendBookingCreatedWebhook(
  booking: BookedSlot,
  config: Partial<SchedulerConfig>
): Promise<void> {
  await sendWebhook('booking.created', booking, config);
}

// Send booking cancelled webhook
export async function sendBookingCancelledWebhook(
  booking: BookedSlot,
  config: Partial<SchedulerConfig>
): Promise<void> {
  await sendWebhook('booking.cancelled', booking, config);
}

// Send booking updated webhook
export async function sendBookingUpdatedWebhook(
  booking: BookedSlot,
  config: Partial<SchedulerConfig>
): Promise<void> {
  await sendWebhook('booking.updated', booking, config);
}

// Process incoming webhook from Microsoft Graph (calendar notifications)
export async function processMicrosoftWebhook(
  validationToken: string | null,
  body: any
): Promise<{ validationToken?: string; processed: boolean }> {
  // Handle validation request
  if (validationToken) {
    return { validationToken, processed: false };
  }

  // Process notifications
  if (body?.value) {
    for (const notification of body.value) {
      console.log('Received Microsoft Graph notification:', notification);
      
      // Handle different change types
      switch (notification.changeType) {
        case 'created':
          console.log('Calendar event created:', notification.resourceData);
          break;
        case 'updated':
          console.log('Calendar event updated:', notification.resourceData);
          break;
        case 'deleted':
          console.log('Calendar event deleted:', notification.resourceData);
          break;
      }
    }
  }

  return { processed: true };
}

// Create Microsoft Graph subscription for calendar changes
export async function createCalendarSubscription(
  graphClient: any,
  notificationUrl: string
): Promise<any> {
  const subscription = {
    changeType: 'created,updated,deleted',
    notificationUrl,
    resource: '/me/calendar/events',
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    clientState: WEBHOOK_SECRET,
  };

  try {
    const result = await graphClient.api('/subscriptions').post(subscription);
    console.log('Calendar subscription created:', result.id);
    return result;
  } catch (error) {
    console.error('Failed to create calendar subscription:', error);
    throw error;
  }
}

// Renew Microsoft Graph subscription
export async function renewCalendarSubscription(
  graphClient: any,
  subscriptionId: string
): Promise<void> {
  try {
    await graphClient.api(`/subscriptions/${subscriptionId}`).patch({
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    console.log('Calendar subscription renewed:', subscriptionId);
  } catch (error) {
    console.error('Failed to renew calendar subscription:', error);
    throw error;
  }
}

// Delete Microsoft Graph subscription
export async function deleteCalendarSubscription(
  graphClient: any,
  subscriptionId: string
): Promise<void> {
  try {
    await graphClient.api(`/subscriptions/${subscriptionId}`).delete();
    console.log('Calendar subscription deleted:', subscriptionId);
  } catch (error) {
    console.error('Failed to delete calendar subscription:', error);
    throw error;
  }
}
