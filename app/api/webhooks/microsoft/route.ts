// POST /api/webhooks/microsoft - Receive Microsoft Graph notifications
import { NextRequest, NextResponse } from 'next/server';
import { processMicrosoftWebhook } from '@/lib/webhooks';

export async function POST(request: NextRequest) {
  try {
    // Handle validation request from Microsoft
    const validationToken = request.nextUrl.searchParams.get('validationToken');
    
    if (validationToken) {
      // Return the validation token as plain text
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    
    // Verify client state (webhook secret)
    const clientState = request.headers.get('ClientState');
    if (clientState !== process.env.WEBHOOK_SECRET) {
      console.warn('Invalid webhook client state');
      return NextResponse.json(
        { success: false, error: 'Invalid client state' },
        { status: 401 }
      );
    }
    
    // Process the notification
    const body = await request.json();
    await processMicrosoftWebhook(null, body);
    
    // Always return 202 Accepted for notifications
    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 200 anyway to prevent Microsoft from retrying
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

// GET - Handle validation requests
export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken');
  
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  
  return NextResponse.json(
    { success: false, error: 'Missing validation token' },
    { status: 400 }
  );
}
