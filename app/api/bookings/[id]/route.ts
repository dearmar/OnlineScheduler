// GET/PUT/DELETE /api/bookings/[id] - Single booking operations (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, updateBooking, deleteBooking, getConfig, getUserIdFromBooking } from '@/lib/storage';
import { deleteCalendarEvent, updateCalendarEvent, isConnected } from '@/lib/microsoft-graph';
import { sendCancellationEmail } from '@/lib/email';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Get booking details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    const booking = await getBookingById(id);
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    const bookingUserId = await getUserIdFromBooking(id);
    if (bookingUserId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
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
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    // Verify ownership
    const bookingUserId = await getUserIdFromBooking(id);
    if (bookingUserId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const updates = await request.json();
    const booking = await getBookingById(id);
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Update calendar event if Outlook is connected
    if (booking.outlookEventId && await isConnected(authUser.userId)) {
      const config = await getConfig(authUser.userId);
      
      if (updates.date || updates.time) {
        await updateCalendarEvent(authUser.userId, booking.outlookEventId, {
          start: {
            dateTime: `${updates.date || booking.date}T${updates.time || booking.time}:00`,
            timeZone: config.timezone,
          },
        });
      }
    }
    
    const updatedBooking = await updateBooking(id, updates);
    
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
    const authUser = await getAuthenticatedUser(request);
    
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    // Verify ownership
    const bookingUserId = await getUserIdFromBooking(id);
    if (bookingUserId !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const booking = await getBookingById(id);
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }
    
    // Delete calendar event if Outlook is connected
    if (booking.outlookEventId && await isConnected(authUser.userId)) {
      await deleteCalendarEvent(authUser.userId, booking.outlookEventId);
    }
    
    // Cancel booking in database
    await deleteBooking(id);
    
    // Send cancellation email
    try {
      const config = await getConfig(authUser.userId);
      await sendCancellationEmail(booking, config);
    } catch (emailError) {
      console.error('Email error:', emailError);
    }
    
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
