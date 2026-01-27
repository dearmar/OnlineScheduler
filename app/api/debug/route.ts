import { NextResponse } from 'next/server';
import { isConnected, getFreeBusySchedule, getStoredTokens } from '@/lib/microsoft-graph';
import { getConfig } from '@/lib/storage';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
  
  try {
    const config = await getConfig();
    const tokens = await getStoredTokens();
    const connected = await isConnected();
    
    let calendarData = null;
    let calendarError = null;
    
    if (connected) {
      try {
        const startDateTime = `${date}T${config.startHour.toString().padStart(2, '0')}:00:00`;
        const endDateTime = `${date}T${config.endHour.toString().padStart(2, '0')}:00:00`;
        
        calendarData = await getFreeBusySchedule(
          startDateTime,
          endDateTime,
          config.timezone
        );
      } catch (e: any) {
        calendarError = e.message;
      }
    }
    
    return NextResponse.json({
      outlookConnected: connected,
      hasTokens: !!tokens,
      tokenExpiresAt: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
      calendarSyncEnabled: process.env.ENABLE_CALENDAR_SYNC,
      timezone: config.timezone,
      startHour: config.startHour,
      endHour: config.endHour,
      dateChecked: date,
      calendarData,
      calendarError
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
