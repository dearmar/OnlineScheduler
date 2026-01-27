// GET /api/availability - Get available time slots
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getAvailableSlots } from '@/lib/storage';
import { getFreeBusySchedule, isConnected } from '@/lib/microsoft-graph';

// Force dynamic for database queries
export const dynamic = 'force-dynamic';

// Format time for display
function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Convert UTC datetime string to local time string in specified timezone
function utcToLocalTime(utcDateTimeStr: string, timezone: string): string {
  // Parse as UTC by appending Z
  const utcDate = new Date(utcDateTimeStr + 'Z');
  
  // Convert to the target timezone
  const localTime = utcDate.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return localTime;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const duration = searchParams.get('duration');
    
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      );
    }
    
    const config = await getConfig();
    const meetingDuration = duration ? parseInt(duration) : 30;
    
    // Validate the date is not in the past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestedDate < today) {
      return NextResponse.json({
        success: true,
        data: {
          date,
          slots: [],
          message: 'Cannot book dates in the past',
        },
      });
    }
    
    // Check if it's a weekend
    const dayOfWeek = requestedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        data: {
          date,
          slots: [],
          message: 'Not available on weekends',
        },
      });
    }
    
    // Get available slots based on bookings
    let availableSlots = await getAvailableSlots(
      date,
      meetingDuration,
      config.startHour,
      config.endHour
    );
    
    // If Outlook is connected, also check calendar availability
    if (await isConnected() && process.env.ENABLE_CALENDAR_SYNC === 'true') {
      try {
        const startDateTime = `${date}T${config.startHour.toString().padStart(2, '0')}:00:00`;
        const endDateTime = `${date}T${config.endHour.toString().padStart(2, '0')}:00:00`;
        
        const schedule = await getFreeBusySchedule(
          startDateTime,
          endDateTime,
          config.timezone
        );
        
        // Filter out busy times
        if (schedule?.scheduleItems) {
          const busyTimes = schedule.scheduleItems
            .filter((item: any) => item.status === 'busy' || item.status === 'tentative')
            .map((item: any) => {
              // The calendar returns times in UTC, convert to local timezone
              const startLocal = utcToLocalTime(item.start.dateTime, config.timezone);
              const endLocal = utcToLocalTime(item.end.dateTime, config.timezone);
              
              return {
                start: startLocal,
                end: endLocal,
              };
            });
          
          availableSlots = availableSlots.filter(slot => {
            const slotMinutes = timeToMinutes(slot);
            const slotEndMinutes = slotMinutes + meetingDuration;
            
            return !busyTimes.some((busy: any) => {
              const busyStart = timeToMinutes(busy.start);
              const busyEnd = timeToMinutes(busy.end);
              return slotMinutes < busyEnd && slotEndMinutes > busyStart;
            });
          });
        }
      } catch (calendarError) {
        console.error('Failed to check calendar availability:', calendarError);
        // Continue with just booking-based availability
      }
    }
    
    // If the date is today, filter out past time slots
    if (requestedDate.toDateString() === today.toDateString()) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      availableSlots = availableSlots.filter(slot => {
        const slotMinutes = timeToMinutes(slot);
        return slotMinutes > currentMinutes + 30; // Add 30 min buffer
      });
    }
    
    // Format slots for response
    const formattedSlots = availableSlots.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      return {
        time,
        display: formatTime(hours, minutes),
      };
    });
    
    return NextResponse.json({
      success: true,
      data: {
        date,
        duration: meetingDuration,
        timezone: config.timezone,
        slots: formattedSlots,
      },
    });
  } catch (error) {
    console.error('Get availability error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve availability' },
      { status: 500 }
    );
  }
}

// Convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
