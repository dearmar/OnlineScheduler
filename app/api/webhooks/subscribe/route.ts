// POST /api/webhooks/subscribe - Subscribe to webhook notifications
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isAuthenticated } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: string;
  active: boolean;
}

// GET - List webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    // if (!(await isAuthenticated(request))) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const subscriptions = await kv.get<string>('webhook_subscriptions');
    const parsed: WebhookSubscription[] = subscriptions ? JSON.parse(subscriptions) : [];
    
    // Hide secrets in response
    const safeSubscriptions = parsed.map(sub => ({
      ...sub,
      secret: '********',
    }));
    
    return NextResponse.json({
      success: true,
      data: safeSubscriptions,
    });
  } catch (error) {
    console.error('Get webhooks error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve webhook subscriptions' },
      { status: 500 }
    );
  }
}

// POST - Create new webhook subscription
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    // if (!(await isAuthenticated(request))) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const { url, events } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Webhook URL is required' },
        { status: 400 }
      );
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }
    
    // Validate events
    const validEvents = ['booking.created', 'booking.updated', 'booking.cancelled'];
    const subscribedEvents = events?.length > 0 
      ? events.filter((e: string) => validEvents.includes(e))
      : validEvents;
    
    // Generate subscription
    const subscription: WebhookSubscription = {
      id: uuidv4(),
      url,
      events: subscribedEvents,
      secret: uuidv4().replace(/-/g, ''),
      createdAt: new Date().toISOString(),
      active: true,
    };
    
    // Save subscription
    const existingRaw = await kv.get<string>('webhook_subscriptions');
    const existing: WebhookSubscription[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(subscription);
    await kv.set('webhook_subscriptions', JSON.stringify(existing));
    
    return NextResponse.json({
      success: true,
      data: subscription,
      message: 'Webhook subscription created. Store the secret securely - it will not be shown again.',
    });
  } catch (error) {
    console.error('Create webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create webhook subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Remove webhook subscription
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    // if (!(await isAuthenticated(request))) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }
    
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      );
    }
    
    const existingRaw = await kv.get<string>('webhook_subscriptions');
    const existing: WebhookSubscription[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = existing.filter(sub => sub.id !== id);
    
    if (filtered.length === existing.length) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }
    
    await kv.set('webhook_subscriptions', JSON.stringify(filtered));
    
    return NextResponse.json({
      success: true,
      message: 'Webhook subscription deleted',
    });
  } catch (error) {
    console.error('Delete webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete webhook subscription' },
      { status: 500 }
    );
  }
}
