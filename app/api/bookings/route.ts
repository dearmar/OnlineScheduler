// GET/POST /api/bookings - Bookings management (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getBookings, addBooking, getConfig, isSlotAvailable, getUserBySlugOrId } from '@/lib/storage';
import { createCalendarEvent, isConnected, getWindowsTimezone } from '@/lib/microsoft-graph';
import { sendBookingEmails } from '@/lib/email';
import { sendBookingCreatedWebhook } from '@/lib/webhooks';
import { OutlookEvent } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/auth';
import { noCacheResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Retrieve all bookings (admin only)
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return noCacheResponse({ success: false, error: 'Unauthorized' }, 401);
    }
    
    const bookings = await getBookings(authUser.userId);
    
    return noCacheResponse({ success: true, data: bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return noCacheResponse({ success: false, error: 'Failed to retrieve bookings' }, 500);
  }
}

// POST - Create a new booking (public)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user: userParam, date, time, duration, meetingType, clientName, clientEmail, notes } = body;
    
    if (!userParam) {
      return NextResponse.json(
        { success: false, error: 'User parameter required' },
        { status: 400 }
      );
    }
    
    // Get user
    const user = await getUserBySlugOrId(userParam);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Validate required fields
    if (!date || !time || !duration || !meetingType || !clientName || !clientEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // Check if slot is still available
    const available = await isSlotAvailable(user.id, date, time, duration);
    if (!available) {
      return NextResponse.json(
        { success: false, error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }
    
    // Get config for calendar event and emails
    const config = await getConfig(user.id);
    
    // Create calendar event if Outlook is connected
    let outlookEventId: string | undefined;
    if (await isConnected(user.id)) {
      const [hours, minutes] = time.split(':').map(Number);
      const endHours = hours + Math.floor((minutes + duration) / 60);
      const endMinutes = (minutes + duration) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      // Convert IANA timezone to Windows timezone for Microsoft Graph
      const windowsTimezone = getWindowsTimezone(config.timezone);
      
      const event: OutlookEvent = {
        subject: `${meetingType} with ${clientName}`,
        body: {
          contentType: 'HTML',
          content: `<p>Meeting booked via ${config.businessName}</p><p><strong>Client:</strong> ${clientName} (${clientEmail})</p>${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}`,
        },
        start: {
          dateTime: `${date}T${time}:00`,
          timeZone: windowsTimezone,
        },
        end: {
          dateTime: `${date}T${endTime}:00`,
          timeZone: windowsTimezone,
        },
        attendees: [
          {
            emailAddress: {
              address: clientEmail,
              name: clientName,
            },
            type: 'required',
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      };
      
      const createdEvent = await createCalendarEvent(user.id, event);
      if (createdEvent?.id) {
        outlookEventId = createdEvent.id;
      }
    }
    
    // Save booking to database
    const booking = await addBooking(user.id, {
      date,
      time,
      duration,
      meetingType,
      clientName,
      clientEmail,
      notes,
      outlookEventId,
    });
    
    // Send confirmation emails
    try {
      await sendBookingEmails(booking, config);
    } catch (emailError) {
      console.error('Email error:', emailError);
    }
    
    // Send webhook
    try {
      await sendBookingCreatedWebhook(user.id, booking, config);
    } catch (webhookError) {
      console.error('Webhook error:', webhookError);
    }
    
    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
