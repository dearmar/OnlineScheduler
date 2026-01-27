// GET/POST /api/bookings - Bookings management
import { NextRequest, NextResponse } from 'next/server';
import { getBookings, addBooking, getConfig, isSlotAvailable } from '@/lib/storage';
import { createCalendarEvent, isConnected } from '@/lib/microsoft-graph';
import { sendBookingEmails } from '@/lib/email';
import { sendBookingCreatedWebhook } from '@/lib/webhooks';
import { OutlookEvent } from '@/lib/types';

// GET - Retrieve all bookings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    let bookings = await getBookings();
    
    // Filter by date if provided
    if (date) {
      bookings = bookings.filter(b => b.date === date);
    } else if (startDate && endDate) {
      bookings = bookings.filter(b => b.date >= startDate && b.date <= endDate);
    }
    
    return NextResponse.json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve bookings' },
      { status: 500 }
    );
  }
}

// POST - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, time, duration, meetingType, clientName, clientEmail, notes } = body;
    
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
    
    // Check if slot is available
    const available = await isSlotAvailable(date, time, duration);
    if (!available) {
      return NextResponse.json(
        { success: false, error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }
    
    // Get config for email and calendar
    const config = await getConfig();
    
    // Create the booking
    const booking = await addBooking({
      date,
      time,
      duration,
      meetingType,
      clientName,
      clientEmail,
      notes,
    });
    
    // Create calendar event if Outlook is connected
    if (await isConnected() && process.env.ENABLE_CALENDAR_SYNC === 'true') {
      try {
        // Calculate end time
        const [hours, minutes] = time.split(':').map(Number);
        const endMinutes = hours * 60 + minutes + duration;
        const endHours = Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        
        // Use local time format (NOT ISO/UTC) since we're specifying timezone separately
        const calendarEvent: OutlookEvent = {
          subject: `${meetingType}: ${clientName}`,
          body: {
            contentType: 'HTML',
            content: `
              <h2>Meeting Details</h2>
              <p><strong>Client:</strong> ${clientName}</p>
              <p><strong>Email:</strong> ${clientEmail}</p>
              <p><strong>Type:</strong> ${meetingType}</p>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              <hr>
              <p><em>Booked via Calendar Scheduler</em></p>
            `,
          },
          start: {
            dateTime: `${date}T${time}:00`,
            timeZone: config.timezone,
          },
          end: {
            dateTime: `${date}T${endTime}:00`,
            timeZone: config.timezone,
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
        
        const createdEvent = await createCalendarEvent(calendarEvent);
        
        // Update booking with Outlook event ID
        if (createdEvent.id) {
          booking.outlookEventId = createdEvent.id;
        }
      } catch (calendarError) {
        console.error('Failed to create calendar event:', calendarError);
        // Continue without failing the booking
      }
    }
    
    // Send confirmation emails
    try {
      await sendBookingEmails(booking, config);
    } catch (emailError) {
      console.error('Failed to send emails:', emailError);
      // Continue without failing the booking
    }
    
    // Send webhook notification
    try {
      await sendBookingCreatedWebhook(booking, config);
    } catch (webhookError) {
      console.error('Failed to send webhook:', webhookError);
      // Continue without failing the booking
    }
    
    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking created successfully',
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
