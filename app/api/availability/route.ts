// GET /api/availability - Get available time slots (multi-tenant)
import { NextRequest, NextResponse } from 'next/server';
import { getConfig, getAvailableSlots, getUserBySlugOrId } from '@/lib/storage';
import { getFreeBusySchedule, isConnected } from '@/lib/microsoft-graph';

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
    
    // Check if date is a weekend
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
    
    // Get available slots from database
    let slots = await getAvailableSlots(user.id, date, duration);
    
    // Get config for timezone and calendar sync check
    const config = await getConfig(user.id);
    
    // If Outlook is connected and calendar sync is enabled, filter out busy times
    if (await isConnected(user.id) && process.env.ENABLE_CALENDAR_SYNC === 'true') {
      try {
        const busyTimes = await getFreeBusySchedule(user.id, date, date, config.timezone);
        
        if (busyTimes.length > 0) {
          slots = slots.filter(slot => {
            const [hours, minutes] = slot.split(':').map(Number);
            const slotStart = hours * 60 + minutes;
            const slotEnd = slotStart + duration;
            
            for (const busy of busyTimes) {
              const busyStartLocal = utcToLocalTime(busy.start, config.timezone);
              const busyEndLocal = utcToLocalTime(busy.end, config.timezone);
              
              const [busyStartHours, busyStartMins] = busyStartLocal.split(':').map(Number);
              const [busyEndHours, busyEndMins] = busyEndLocal.split(':').map(Number);
              const busyStart = busyStartHours * 60 + busyStartMins;
              const busyEnd = busyEndHours * 60 + busyEndMins;
              
              if ((slotStart >= busyStart && slotStart < busyEnd) ||
                  (slotEnd > busyStart && slotEnd <= busyEnd) ||
                  (slotStart <= busyStart && slotEnd >= busyEnd)) {
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
