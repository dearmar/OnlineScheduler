// POST /api/webhooks/subscribe - Subscribe to webhook notifications

// Force dynamic
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
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
    
    const result = await sql`
      SELECT id, url, events, secret, created_at, is_active as active
      FROM webhook_subscriptions
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    
    // Hide secrets in response
    const safeSubscriptions = result.map(sub => ({
      id: sub.id,
      url: sub.url,
      events: sub.events,
      secret: '********',
      createdAt: sub.created_at,
      active: sub.active,
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
    const id = uuidv4();
    const secret = uuidv4().replace(/-/g, '');
    
    const result = await sql`
      INSERT INTO webhook_subscriptions (id, url, events, secret, is_active)
      VALUES (${id}::uuid, ${url}, ${subscribedEvents}, ${secret}, true)
      RETURNING id, url, events, secret, created_at, is_active as active
    `;
    
    const subscription = result[0];
    
    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        url: subscription.url,
        events: subscription.events,
        secret: subscription.secret, // Only shown once
        createdAt: subscription.created_at,
        active: subscription.active,
      },
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
    
    const result = await sql`
      UPDATE webhook_subscriptions 
      SET is_active = false 
      WHERE id = ${id}::uuid
      RETURNING id
    `;
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }
    
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
