// GET/POST /api/bookings - Bookings management (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getBookings, addBooking, getConfig, isSlotAvailable, getUserBySlugOrId } from '@/lib/storage';
import { createCalendarEvent, isConnected, getWindowsTimezone } from '@/lib/microsoft-graph';
import { createGoogleCalendarEvent, isGoogleConnected } from '@/lib/google-calendar';
import { sendBookingEmails } from '@/lib/email';
import { sendBookingCreatedWebhook } from '@/lib/webhooks';
import { OutlookEvent, GoogleCalendarEvent, LocationType } from '@/lib/types';
import { getAuthenticatedUser } from '@/lib/auth';
import { noCacheResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Phone number validation regex (accepts common formats)
const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

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
    const { 
      user: userParam, date, time, duration, meetingType, 
      clientName, clientEmail, clientPhone, notes,
      locationType, location 
    } = body;
    
    console.log(`[Booking] POST request received - user param: ${userParam}, date: ${date}, time: ${time}`);
    
    if (!userParam) {
      return NextResponse.json(
        { success: false, error: 'User parameter required' },
        { status: 400 }
      );
    }
    
    // Get user
    const user = await getUserBySlugOrId(userParam);
    if (!user) {
      console.log(`[Booking] User not found for param: ${userParam}`);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    console.log(`[Booking] Found user: ${user.id} (${user.slug})`);
    
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
    
    // Validate phone number for phone call meetings
    if (locationType === 'phone' && !clientPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required for phone call meetings' },
        { status: 400 }
      );
    }
    
    if (clientPhone && !phoneRegex.test(clientPhone.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
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
    console.log(`[Booking] Config loaded: calendarProvider=${config.calendarProvider}`);
    
    // Build location string for calendar event
    let eventLocation = '';
    if (locationType === 'in_person' && location) {
      eventLocation = location;
    } else if (locationType === 'phone' && clientPhone) {
      eventLocation = `Phone: ${clientPhone}`;
    } else if (locationType === 'virtual' && location) {
      eventLocation = location;
    }
    
    // Create calendar event based on provider
    let calendarEventId: string | undefined;
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const endHours = hours + Math.floor((minutes + duration) / 60);
      const endMinutes = (minutes + duration) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      const outlookConnected = await isConnected(user.id);
      console.log(`[Booking] Outlook connected check: ${outlookConnected}`);
      
      if (config.calendarProvider === 'outlook' && outlookConnected) {
        console.log(`[Booking] Creating Outlook calendar event`);
        
        const windowsTimezone = getWindowsTimezone(config.timezone);
        
        const event: OutlookEvent = {
          subject: `${meetingType} with ${clientName}`,
          body: {
            contentType: 'HTML',
            content: buildEventBody(config.businessName, clientName, clientEmail, clientPhone, notes, locationType, location),
          },
          start: {
            dateTime: `${date}T${time}:00`,
            timeZone: windowsTimezone,
          },
          end: {
            dateTime: `${date}T${endTime}:00`,
            timeZone: windowsTimezone,
          },
          location: eventLocation ? { displayName: eventLocation } : undefined,
          attendees: [
            {
              emailAddress: {
                address: clientEmail,
                name: clientName,
              },
              type: 'required',
            },
          ],
        };
        
        const createdEvent = await createCalendarEvent(user.id, event);
        if (createdEvent?.id) {
          calendarEventId = createdEvent.id;
          console.log(`[Booking] Outlook event created: ${calendarEventId}`);
        }
      } else if (config.calendarProvider === 'google' && await isGoogleConnected(user.id)) {
        console.log(`[Booking] Creating Google calendar event`);
        console.log(`[Booking] Event time: ${date}T${time}:00, timezone: ${config.timezone}`);
        
        const event: GoogleCalendarEvent = {
          summary: `${meetingType} with ${clientName}`,
          description: buildEventBody(config.businessName, clientName, clientEmail, clientPhone, notes, locationType, location),
          start: {
            dateTime: `${date}T${time}:00`,
            timeZone: config.timezone,
          },
          end: {
            dateTime: `${date}T${endTime}:00`,
            timeZone: config.timezone,
          },
          location: eventLocation || undefined,
          attendees: [
            {
              email: clientEmail,
              displayName: clientName,
            },
          ],
        };
        
        const createdEvent = await createGoogleCalendarEvent(user.id, event);
        if (createdEvent?.id) {
          calendarEventId = createdEvent.id;
          console.log(`[Booking] Google event created: ${calendarEventId}`);
        }
      } else {
        console.log(`[Booking] No calendar provider connected for user ${user.id}`);
      }
    } catch (calendarError: any) {
      console.error(`[Booking] Calendar event creation error:`, calendarError.message || calendarError);
      // Continue with booking even if calendar fails
    }
    
    // Save booking to database
    const booking = await addBooking(user.id, {
      date,
      time,
      duration,
      meetingType,
      clientName,
      clientEmail,
      clientPhone,
      notes,
      locationType,
      location,
      calendarEventId,
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

// Helper function to build event body
function buildEventBody(
  businessName: string, 
  clientName: string, 
  clientEmail: string, 
  clientPhone?: string, 
  notes?: string,
  locationType?: LocationType,
  location?: string
): string {
  let body = `<p>Meeting booked via ${businessName}</p>`;
  body += `<p><strong>Client:</strong> ${clientName} (${clientEmail})</p>`;
  
  if (clientPhone) {
    body += `<p><strong>Phone:</strong> ${clientPhone}</p>`;
  }
  
  if (locationType && location) {
    const locationLabel = locationType === 'in_person' ? 'Location' : 
                          locationType === 'virtual' ? 'Meeting Link' : 'Phone';
    body += `<p><strong>${locationLabel}:</strong> ${location}</p>`;
  }
  
  if (notes) {
    body += `<p><strong>Notes:</strong> ${notes}</p>`;
  }
  
  return body;
}
