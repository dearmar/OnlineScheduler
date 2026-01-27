// Database storage operations - Multi-tenant version
import { sql } from './db/client';
import { SchedulerConfig, MeetingType, BookedSlot } from './types';
import { v4 as uuidv4 } from 'uuid';
import { unstable_noStore as noStore } from 'next/cache';

// Default configuration for new users
const defaultConfig: Omit<SchedulerConfig, 'meetingTypes' | 'bookedSlots'> = {
  businessName: 'Your Business',
  logo: null,
  primaryColor: '#1a1a2e',
  accentColor: '#4f46e5',
  startHour: 9,
  endHour: 17,
  timezone: 'America/New_York',
  outlookEmail: '',
  outlookConnected: false,
};

// Default meeting types for new users
const defaultMeetingTypes: Omit<MeetingType, 'id'>[] = [
  { name: 'Quick Chat', duration: 15, description: 'A brief 15-minute consultation', color: '#10b981' },
  { name: 'Standard Meeting', duration: 30, description: 'A focused 30-minute discussion', color: '#4f46e5' },
  { name: 'Deep Dive', duration: 60, description: 'An in-depth 60-minute session', color: '#8b5cf6' },
];

// Get user by slug or ID
export async function getUserBySlugOrId(slugOrId: string): Promise<{ id: string; name: string; slug: string } | null> {
  noStore();
  
  console.log(`[Storage] getUserBySlugOrId called with: ${slugOrId}`);
  
  const result = await sql`
    SELECT id, name, slug FROM admin_users 
    WHERE slug = ${slugOrId} OR id::text = ${slugOrId}
    LIMIT 1
  `;
  
  if (result.length === 0) {
    console.log(`[Storage] No user found for: ${slugOrId}`);
    return null;
  }
  
  console.log(`[Storage] Found user: id=${result[0].id}, name=${result[0].name}, slug=${result[0].slug}`);
  return { id: result[0].id, name: result[0].name, slug: result[0].slug };
}

// Ensure config exists for user (creates default if not)
export async function ensureUserConfig(userId: string): Promise<void> {
  // Check if config exists
  const existing = await sql`SELECT id FROM scheduler_config WHERE user_id = ${userId}::uuid`;
  
  if (existing.length === 0) {
    // Create default config
    await sql`
      INSERT INTO scheduler_config (user_id, business_name, primary_color, accent_color, start_hour, end_hour, timezone)
      VALUES (${userId}::uuid, ${defaultConfig.businessName}, ${defaultConfig.primaryColor}, ${defaultConfig.accentColor}, ${defaultConfig.startHour}, ${defaultConfig.endHour}, ${defaultConfig.timezone})
    `;
    
    // Create default meeting types
    for (const mt of defaultMeetingTypes) {
      await sql`
        INSERT INTO meeting_types (user_id, name, duration, description, color, sort_order)
        VALUES (${userId}::uuid, ${mt.name}, ${mt.duration}, ${mt.description || ''}, ${mt.color}, ${defaultMeetingTypes.indexOf(mt) + 1})
      `;
    }
  }
}

// Get configuration for a specific user
export async function getConfig(userId: string): Promise<SchedulerConfig> {
  noStore();
  
  // Ensure config exists
  await ensureUserConfig(userId);
  
  // Get config
  const configResult = await sql`
    SELECT business_name, logo, primary_color, accent_color, start_hour, end_hour, timezone, outlook_email, outlook_connected
    FROM scheduler_config
    WHERE user_id = ${userId}::uuid
  `;
  
  const config = configResult[0];
  
  // Get meeting types
  const meetingTypes = await sql`
    SELECT id, name, duration, description, color
    FROM meeting_types
    WHERE user_id = ${userId}::uuid AND is_active = true
    ORDER BY sort_order ASC, created_at ASC
  `;
  
  // Get booked slots
  const bookedSlots = await sql`
    SELECT id, date, time, duration, meeting_type_name, client_name, client_email, notes, outlook_event_id, created_at
    FROM bookings
    WHERE user_id = ${userId}::uuid AND status = 'confirmed'
    ORDER BY date ASC, time ASC
  `;
  
  return {
    businessName: config.business_name,
    logo: config.logo,
    primaryColor: config.primary_color,
    accentColor: config.accent_color,
    startHour: config.start_hour,
    endHour: config.end_hour,
    timezone: config.timezone,
    outlookEmail: config.outlook_email || '',
    outlookConnected: config.outlook_connected,
    meetingTypes: meetingTypes.map(mt => ({
      id: mt.id,
      name: mt.name,
      duration: mt.duration as 15 | 30 | 60,
      description: mt.description || '',
      color: mt.color,
    })),
    bookedSlots: bookedSlots.map(slot => ({
      id: slot.id,
      date: slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : String(slot.date),
      time: String(slot.time).substring(0, 5),
      duration: slot.duration,
      meetingType: slot.meeting_type_name,
      clientName: slot.client_name,
      clientEmail: slot.client_email,
      notes: slot.notes,
      outlookEventId: slot.outlook_event_id,
      createdAt: slot.created_at,
    })),
  };
}

// Update configuration for a specific user
export async function updateConfig(userId: string, updates: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
  // Ensure config exists
  await ensureUserConfig(userId);
  
  // Update scheduler_config table
  if (updates.businessName !== undefined || updates.logo !== undefined || 
      updates.primaryColor !== undefined || updates.accentColor !== undefined ||
      updates.startHour !== undefined || updates.endHour !== undefined || 
      updates.timezone !== undefined || updates.outlookEmail !== undefined ||
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
      WHERE user_id = ${userId}::uuid
    `;
  }
  
  // Handle meeting types updates
  if (updates.meetingTypes) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    for (let i = 0; i < updates.meetingTypes.length; i++) {
      const mt = updates.meetingTypes[i];
      const isValidUUID = uuidRegex.test(mt.id);
      
      if (isValidUUID) {
        // Check if exists for this user
        const existing = await sql`SELECT id FROM meeting_types WHERE id = ${mt.id}::uuid AND user_id = ${userId}::uuid`;
        
        if (existing.length > 0) {
          await sql`
            UPDATE meeting_types SET
              name = ${mt.name},
              duration = ${mt.duration},
              description = ${mt.description || ''},
              color = ${mt.color},
              sort_order = ${i + 1}
            WHERE id = ${mt.id}::uuid AND user_id = ${userId}::uuid
          `;
        } else {
          await sql`
            INSERT INTO meeting_types (id, user_id, name, duration, description, color, sort_order)
            VALUES (${mt.id}::uuid, ${userId}::uuid, ${mt.name}, ${mt.duration}, ${mt.description || ''}, ${mt.color}, ${i + 1})
          `;
        }
      } else {
        // Insert new with generated UUID
        const newId = uuidv4();
        await sql`
          INSERT INTO meeting_types (id, user_id, name, duration, description, color, sort_order)
          VALUES (${newId}::uuid, ${userId}::uuid, ${mt.name}, ${mt.duration}, ${mt.description || ''}, ${mt.color}, ${i + 1})
        `;
      }
    }
    
    // Deactivate meeting types not in the update list
    const activeIds = updates.meetingTypes
      .filter(mt => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mt.id))
      .map(mt => mt.id);
    
    if (activeIds.length > 0) {
      await sql`
        UPDATE meeting_types SET is_active = false 
        WHERE user_id = ${userId}::uuid AND id != ALL(${activeIds}::uuid[])
      `;
    }
  }
  
  return getConfig(userId);
}

// Get all bookings for a user
export async function getBookings(userId: string): Promise<BookedSlot[]> {
  noStore();
  
  const bookings = await sql`
    SELECT id, date, time, duration, meeting_type_name, client_name, client_email, notes, outlook_event_id, status, created_at
    FROM bookings
    WHERE user_id = ${userId}::uuid
    ORDER BY date DESC, time DESC
  `;
  
  return bookings.map(slot => ({
    id: slot.id,
    date: slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : String(slot.date),
    time: String(slot.time).substring(0, 5),
    duration: slot.duration,
    meetingType: slot.meeting_type_name,
    clientName: slot.client_name,
    clientEmail: slot.client_email,
    notes: slot.notes,
    outlookEventId: slot.outlook_event_id,
    createdAt: slot.created_at,
  }));
}

// Get booking by ID
export async function getBookingById(bookingId: string): Promise<BookedSlot | null> {
  const result = await sql`
    SELECT id, date, time, duration, meeting_type_name, client_name, client_email, notes, outlook_event_id, created_at
    FROM bookings
    WHERE id = ${bookingId}::uuid
  `;
  
  if (result.length === 0) return null;
  
  const slot = result[0];
  return {
    id: slot.id,
    date: slot.date instanceof Date ? slot.date.toISOString().split('T')[0] : String(slot.date),
    time: String(slot.time).substring(0, 5),
    duration: slot.duration,
    meetingType: slot.meeting_type_name,
    clientName: slot.client_name,
    clientEmail: slot.client_email,
    notes: slot.notes,
    outlookEventId: slot.outlook_event_id,
    createdAt: slot.created_at,
  };
}

// Add a new booking
export async function addBooking(userId: string, booking: Omit<BookedSlot, 'id' | 'createdAt'>): Promise<BookedSlot> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await sql`
    INSERT INTO bookings (id, user_id, date, time, duration, meeting_type_name, client_name, client_email, notes, outlook_event_id)
    VALUES (${id}::uuid, ${userId}::uuid, ${booking.date}, ${booking.time}, ${booking.duration}, ${booking.meetingType}, ${booking.clientName}, ${booking.clientEmail}, ${booking.notes || null}, ${booking.outlookEventId || null})
  `;
  
  return {
    id,
    ...booking,
    createdAt: now,
  };
}

// Update booking
export async function updateBooking(bookingId: string, updates: Partial<BookedSlot>): Promise<BookedSlot | null> {
  await sql`
    UPDATE bookings SET
      date = COALESCE(${updates.date ?? null}, date),
      time = COALESCE(${updates.time ?? null}, time),
      notes = COALESCE(${updates.notes ?? null}, notes),
      outlook_event_id = COALESCE(${updates.outlookEventId ?? null}, outlook_event_id)
    WHERE id = ${bookingId}::uuid
  `;
  
  return getBookingById(bookingId);
}

// Delete (cancel) booking
export async function deleteBooking(bookingId: string): Promise<boolean> {
  await sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId}::uuid`;
  return true;
}

// Check if a slot is available
export async function isSlotAvailable(userId: string, date: string, time: string, duration: number): Promise<boolean> {
  const [hours, minutes] = time.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + duration;
  
  const bookings = await sql`
    SELECT time, duration FROM bookings
    WHERE user_id = ${userId}::uuid AND date = ${date} AND status = 'confirmed'
  `;
  
  for (const booking of bookings) {
    const bookingTime = String(booking.time).substring(0, 5);
    const [bHours, bMinutes] = bookingTime.split(':').map(Number);
    const bookingStart = bHours * 60 + bMinutes;
    const bookingEnd = bookingStart + booking.duration;
    
    if ((startMinutes >= bookingStart && startMinutes < bookingEnd) ||
        (endMinutes > bookingStart && endMinutes <= bookingEnd) ||
        (startMinutes <= bookingStart && endMinutes >= bookingEnd)) {
      return false;
    }
  }
  
  return true;
}

// Get available slots for a date
export async function getAvailableSlots(userId: string, date: string, duration: number): Promise<string[]> {
  const config = await getConfig(userId);
  const slots: string[] = [];
  
  // Generate all possible slots
  for (let hour = config.startHour; hour < config.endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const slotEnd = hour * 60 + minute + duration;
      if (slotEnd <= config.endHour * 60) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        if (await isSlotAvailable(userId, date, time, duration)) {
          slots.push(time);
        }
      }
    }
  }
  
  return slots;
}

// Get user ID from booking
export async function getUserIdFromBooking(bookingId: string): Promise<string | null> {
  const result = await sql`SELECT user_id FROM bookings WHERE id = ${bookingId}::uuid`;
  return result.length > 0 ? result[0].user_id : null;
}
