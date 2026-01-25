// GET/PUT/DELETE /api/bookings/[id] - Single booking operations
import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, deleteBooking, getConfig } from '@/lib/storage';
import { deleteCalendarEvent, updateCalendarEvent, isConnected } from '@/lib/microsoft-graph';
import { sendCancellationEmail } from '@/lib/email';
import { sendBookingCancelledWebhook, sendBookingUpdatedWebhook } from '@/lib/webhooks';

// GET - Get single booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await getBookingById(params.id);
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve booking' },
      { status: 500 }
    );
  }
}

// PUT - Update booking
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    
    const booking = await getBookingById(params.id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    const updatedBooking = await updateBooking(params.id, updates);
    
    if (!updatedBooking) {
      return NextResponse.json(
        { success: false, error: 'Failed to update booking' },
        { status: 500 }
      );
    }
    
    // Update calendar event if connected
    if (booking.outlookEventId && await isConnected()) {
      try {
        const config = await getConfig();
        const [hours, minutes] = (updates.time || booking.time).split(':').map(Number);
        const startDateTime = new Date(updates.date || booking.date);
        startDateTime.setHours(hours, minutes, 0, 0);
        
        const endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + (updates.duration || booking.duration));
        
        await updateCalendarEvent(booking.outlookEventId, {
          subject: `${updatedBooking.meetingType}: ${updatedBooking.clientName}`,
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: config.timezone,
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: config.timezone,
          },
        });
      } catch (calendarError) {
        console.error('Failed to update calendar event:', calendarError);
      }
    }
    
    // Send webhook
    const config = await getConfig();
    await sendBookingUpdatedWebhook(updatedBooking, config);
    
    return NextResponse.json({
      success: true,
      data: updatedBooking,
    });
  } catch (error) {
    console.error('Update booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const booking = await getBookingById(params.id);
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Delete calendar event if exists
    if (booking.outlookEventId && await isConnected()) {
      try {
        await deleteCalendarEvent(booking.outlookEventId);
      } catch (calendarError) {
        console.error('Failed to delete calendar event:', calendarError);
      }
    }
    
    // Send cancellation email
    const config = await getConfig();
    try {
      await sendCancellationEmail(booking, config);
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }
    
    // Send webhook
    await sendBookingCancelledWebhook(booking, config);
    
    // Delete the booking
    await deleteBooking(params.id);
    
    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
