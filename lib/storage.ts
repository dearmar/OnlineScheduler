// Data storage using Neon PostgreSQL
import { sql } from './db/client';
import { SchedulerConfig, BookedSlot, MeetingType } from './types';
import { v4 as uuidv4 } from 'uuid';

// Get scheduler configuration
export async function getConfig(): Promise<SchedulerConfig> {
  try {
    // Get base config
    const configRows = await sql`
      SELECT 
        business_name, logo, primary_color, accent_color,
        start_hour, end_hour, timezone, outlook_email, outlook_connected
      FROM scheduler_config 
      WHERE id = 1
    `;
    
    // Get meeting types
    const meetingTypes = await sql`
      SELECT id, name, duration, description, color
      FROM meeting_types
      WHERE is_active = true
      ORDER BY sort_order ASC
    `;
    
    // Get booked slots
    const bookings = await sql`
      SELECT 
        id, date, time, duration, meeting_type_name as "meetingType",
        client_name as "clientName", client_email as "clientEmail",
        notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
      FROM bookings
      WHERE status = 'confirmed'
      ORDER BY date, time
    `;

    const config = configRows[0] || {};
    
    return {
      businessName: config.business_name || 'Your Business',
      logo: config.logo || null,
      primaryColor: config.primary_color || '#1a1a2e',
      accentColor: config.accent_color || '#4f46e5',
      startHour: config.start_hour || 9,
      endHour: config.end_hour || 17,
      timezone: config.timezone || 'America/New_York',
      outlookEmail: config.outlook_email || '',
      outlookConnected: config.outlook_connected || false,
      meetingTypes: meetingTypes.map(mt => ({
        id: mt.id,
        name: mt.name,
        duration: mt.duration as 15 | 30 | 60,
        description: mt.description || '',
        color: mt.color,
      })),
      bookedSlots: bookings.map(b => ({
        id: b.id,
        date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
        time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
        duration: b.duration,
        meetingType: b.meetingType,
        clientName: b.clientName,
        clientEmail: b.clientEmail,
        notes: b.notes,
        outlookEventId: b.outlookEventId,
        createdAt: b.createdAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
}

// Update partial configuration
export async function updateConfig(updates: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
  try {
    // Update base config fields
    if (updates.businessName !== undefined || 
        updates.logo !== undefined ||
        updates.primaryColor !== undefined ||
        updates.accentColor !== undefined ||
        updates.startHour !== undefined ||
        updates.endHour !== undefined ||
        updates.timezone !== undefined ||
        updates.outlookEmail !== undefined ||
        updates.outlookConnected !== undefined) {
      
      await sql`
        UPDATE scheduler_config SET
          business_name = COALESCE(${updates.businessName ?? null}, business_name),
          logo = COALESCE(${updates.logo ?? null}, logo),
          primary_color = COALESCE(${updates.primaryColor ?? null}, primary_color),
          accent_color = COALESCE(${updates.accentColor ?? null}, accent_color),
          start_hour = COALESCE(${updates.startHour ?? null}, start_hour),
          end_hour = COALESCE(${updates.endHour ?? null}, end_hour),
          timezone = COALESCE(${updates.timezone ?? null}, timezone),
          outlook_email = COALESCE(${updates.outlookEmail ?? null}, outlook_email),
          outlook_connected = COALESCE(${updates.outlookConnected ?? null}, outlook_connected)
        WHERE id = 1
      `;
    }

    // Update meeting types if provided
    if (updates.meetingTypes) {
      // Mark all as inactive first
      await sql`UPDATE meeting_types SET is_active = false`;
      
      // Upsert each meeting type
      for (let i = 0; i < updates.meetingTypes.length; i++) {
        const mt = updates.meetingTypes[i];
        
        // Check if ID is a valid UUID format, if not generate a new one
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUuid = uuidRegex.test(mt.id);
        
        if (isValidUuid) {
          // Update existing or insert with provided UUID
          await sql`
            INSERT INTO meeting_types (id, name, duration, description, color, sort_order, is_active)
            VALUES (${mt.id}::uuid, ${mt.name}, ${mt.duration}, ${mt.description || ''}, ${mt.color}, ${i}, true)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              duration = EXCLUDED.duration,
              description = EXCLUDED.description,
              color = EXCLUDED.color,
              sort_order = EXCLUDED.sort_order,
              is_active = true
          `;
        } else {
          // Insert new with generated UUID
          await sql`
            INSERT INTO meeting_types (name, duration, description, color, sort_order, is_active)
            VALUES (${mt.name}, ${mt.duration}, ${mt.description || ''}, ${mt.color}, ${i}, true)
          `;
        }
      }
    }

    return await getConfig();
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

// Get all bookings
export async function getBookings(): Promise<BookedSlot[]> {
  const bookings = await sql`
    SELECT 
      id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
    FROM bookings
    WHERE status = 'confirmed'
    ORDER BY date DESC, time DESC
  `;
  
  return bookings.map(b => ({
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  }));
}

// Get bookings for a specific date
export async function getBookingsForDate(date: string): Promise<BookedSlot[]> {
  const bookings = await sql`
    SELECT 
      id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
    FROM bookings
    WHERE date = ${date}::date AND status = 'confirmed'
    ORDER BY time
  `;
  
  return bookings.map(b => ({
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  }));
}

// Get bookings for a date range
export async function getBookingsInRange(startDate: string, endDate: string): Promise<BookedSlot[]> {
  const bookings = await sql`
    SELECT 
      id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
    FROM bookings
    WHERE date >= ${startDate}::date 
      AND date <= ${endDate}::date 
      AND status = 'confirmed'
    ORDER BY date, time
  `;
  
  return bookings.map(b => ({
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  }));
}

// Add a new booking
export async function addBooking(booking: Omit<BookedSlot, 'id' | 'createdAt'>): Promise<BookedSlot> {
  const id = uuidv4();
  
  // Find meeting type ID if exists
  const meetingTypeRows = await sql`
    SELECT id FROM meeting_types WHERE name = ${booking.meetingType} AND is_active = true LIMIT 1
  `;
  const meetingTypeId = meetingTypeRows[0]?.id || null;
  
  const result = await sql`
    INSERT INTO bookings (
      id, date, time, duration, meeting_type_id, meeting_type_name,
      client_name, client_email, notes, outlook_event_id
    ) VALUES (
      ${id}::uuid, ${booking.date}::date, ${booking.time}::time, ${booking.duration},
      ${meetingTypeId}::uuid, ${booking.meetingType}, ${booking.clientName},
      ${booking.clientEmail}, ${booking.notes || null}, ${booking.outlookEventId || null}
    )
    RETURNING id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
  `;
  
  const b = result[0];
  return {
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  };
}

// Update a booking
export async function updateBooking(id: string, updates: Partial<BookedSlot>): Promise<BookedSlot | null> {
  const result = await sql`
    UPDATE bookings SET
      date = COALESCE(${updates.date ?? null}::date, date),
      time = COALESCE(${updates.time ?? null}::time, time),
      duration = COALESCE(${updates.duration ?? null}, duration),
      meeting_type_name = COALESCE(${updates.meetingType ?? null}, meeting_type_name),
      client_name = COALESCE(${updates.clientName ?? null}, client_name),
      client_email = COALESCE(${updates.clientEmail ?? null}, client_email),
      notes = COALESCE(${updates.notes ?? null}, notes),
      outlook_event_id = COALESCE(${updates.outlookEventId ?? null}, outlook_event_id)
    WHERE id = ${id}::uuid
    RETURNING id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
  `;
  
  if (result.length === 0) return null;
  
  const b = result[0];
  return {
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  };
}

// Delete a booking (mark as cancelled)
export async function deleteBooking(id: string): Promise<boolean> {
  const result = await sql`
    UPDATE bookings SET status = 'cancelled' WHERE id = ${id}::uuid
    RETURNING id
  `;
  return result.length > 0;
}

// Get a single booking by ID
export async function getBookingById(id: string): Promise<BookedSlot | null> {
  const result = await sql`
    SELECT 
      id, date, time, duration, meeting_type_name as "meetingType",
      client_name as "clientName", client_email as "clientEmail",
      notes, outlook_event_id as "outlookEventId", created_at as "createdAt"
    FROM bookings
    WHERE id = ${id}::uuid AND status = 'confirmed'
  `;
  
  if (result.length === 0) return null;
  
  const b = result[0];
  return {
    id: b.id,
    date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date,
    time: typeof b.time === 'string' ? b.time.slice(0, 5) : b.time,
    duration: b.duration,
    meetingType: b.meetingType,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    notes: b.notes,
    outlookEventId: b.outlookEventId,
    createdAt: b.createdAt,
  };
}

// Check if a time slot is available
export async function isSlotAvailable(date: string, time: string, duration: number): Promise<boolean> {
  // Calculate end time
  const [hours, minutes] = time.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + duration;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  
  // Check for overlapping bookings
  const result = await sql`
    SELECT COUNT(*) as count FROM bookings
    WHERE date = ${date}::date
      AND status = 'confirmed'
      AND (
        (time <= ${time}::time AND time + (duration || ' minutes')::interval > ${time}::time)
        OR
        (time < ${endTime}::time AND time >= ${time}::time)
      )
  `;
  
  return parseInt(result[0].count) === 0;
}

// Get available time slots for a date
export async function getAvailableSlots(
  date: string,
  duration: number,
  startHour: number,
  endHour: number
): Promise<string[]> {
  const bookings = await getBookingsForDate(date);
  const slots: string[] = [];
  
  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += duration) {
      // Don't create slots that would extend past end hour
      const slotEndMinutes = hour * 60 + minute + duration;
      if (slotEndMinutes > endHour * 60) continue;
      
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const slotStart = hour * 60 + minute;
      const slotEnd = slotStart + duration;
      
      // Check if slot conflicts with any booking
      const hasConflict = bookings.some(booking => {
        const [bHours, bMinutes] = booking.time.split(':').map(Number);
        const bookingStart = bHours * 60 + bMinutes;
        const bookingEnd = bookingStart + booking.duration;
        return slotStart < bookingEnd && slotEnd > bookingStart;
      });
      
      if (!hasConflict) {
        slots.push(time);
      }
    }
  }
  
  return slots;
}

// Get meeting type by ID
export async function getMeetingType(id: string): Promise<MeetingType | null> {
  const result = await sql`
    SELECT id, name, duration, description, color
    FROM meeting_types
    WHERE id = ${id}::uuid AND is_active = true
  `;
  
  if (result.length === 0) return null;
  
  const mt = result[0];
  return {
    id: mt.id,
    name: mt.name,
    duration: mt.duration as 15 | 30 | 60,
    description: mt.description || '',
    color: mt.color,
  };
}
