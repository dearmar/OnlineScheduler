// GET /api/availability - Get available time slots (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getAvailableSlots, getUserBySlugOrId } from '@/lib/storage';
import { getFreeBusySchedule, isConnected } from '@/lib/microsoft-graph';
import { isGoogleConnected, getGoogleFreeBusySchedule } from '@/lib/google-calendar';

export const dynamic = 'force-dynamic';

// Format time for display
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Convert UTC time to local time
function utcToLocalTime(utcDateTimeStr: string, timezone: string): string {
  const utcDate = new Date(utcDateTimeStr + 'Z');
  return utcDate.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userParam = searchParams.get('user');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '30', 10);
    
    console.log(`[Availability] Checking for user=${userParam}, date=${date}, duration=${duration}`);
    
    if (!userParam) {
      return NextResponse.json(
        { success: false, error: 'User parameter required' },
        { status: 400 }
      );
    }
    
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
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
    
    // Get available slots from database (this already checks weekly availability)
    let slots = await getAvailableSlots(user.id, date, duration);
    
    // If no slots (day is disabled or no availability), return empty
    if (slots.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
    
    // Get config for timezone and calendar sync check
    const config = await getConfig(user.id);
    
    // Check calendar sync based on configured provider
    const calendarProvider = config.calendarProvider || 'none';
    let busyTimes: Array<{ start: string; end: string }> = [];
    
    console.log(`[Availability] Calendar sync check: ENABLE_CALENDAR_SYNC=${process.env.ENABLE_CALENDAR_SYNC}, provider=${calendarProvider}`);
    
    if (process.env.ENABLE_CALENDAR_SYNC === 'true' && calendarProvider !== 'none') {
      try {
        if (calendarProvider === 'outlook') {
          const outlookConnected = await isConnected(user.id);
          console.log(`[Availability] Outlook connected: ${outlookConnected}`);
          if (outlookConnected) {
            busyTimes = await getFreeBusySchedule(user.id, date, date, config.timezone) || [];
            console.log(`[Availability] Outlook busy times found: ${busyTimes.length}`);
          }
        } else if (calendarProvider === 'google') {
          const googleConnected = await isGoogleConnected(user.id);
          console.log(`[Availability] Google connected: ${googleConnected}`);
          if (googleConnected) {
            busyTimes = await getGoogleFreeBusySchedule(user.id, date, date, config.timezone) || [];
            console.log(`[Availability] Google busy times found: ${busyTimes.length}`);
          }
        }
        
        if (busyTimes.length > 0) {
          console.log(`[Availability] Busy times:`, JSON.stringify(busyTimes));
          
          slots = slots.filter(slot => {
            const [hours, minutes] = slot.split(':').map(Number);
            const slotStart = hours * 60 + minutes;
            const slotEnd = slotStart + duration;
            
            for (const busy of busyTimes) {
              // Times from Outlook/Google are already in local timezone (we request them that way)
              // Format is like "2026-01-28T09:00:00.0000000" - extract just the time part
              const busyStartTime = busy.start.split('T')[1]?.substring(0, 5) || '00:00';
              const busyEndTime = busy.end.split('T')[1]?.substring(0, 5) || '00:00';
              
              const [busyStartHours, busyStartMins] = busyStartTime.split(':').map(Number);
              const [busyEndHours, busyEndMins] = busyEndTime.split(':').map(Number);
              const busyStart = busyStartHours * 60 + busyStartMins;
              const busyEnd = busyEndHours * 60 + busyEndMins;
              
              // Check if slot overlaps with busy time
              if ((slotStart >= busyStart && slotStart < busyEnd) ||
                  (slotEnd > busyStart && slotEnd <= busyEnd) ||
                  (slotStart <= busyStart && slotEnd >= busyEnd)) {
                console.log(`[Availability] Slot ${slot} blocked by busy time ${busyStartTime}-${busyEndTime}`);
                return false;
              }
            }
            return true;
          });
        }
      } catch (error) {
        console.error('Calendar sync error:', error);
      }
    }
    
    // Filter out past times if date is today
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (date === today) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30;
      slots = slots.filter(slot => {
        const [hours, minutes] = slot.split(':').map(Number);
        return hours * 60 + minutes > currentMinutes;
      });
    }
    
    // Format slots for display
    const formattedSlots = slots.map(time => ({
      time,
      display: formatTime(time),
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedSlots,
    });
  } catch (error) {
    console.error('Availability error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get availability' },
      { status: 500 }
    );
  }
}
