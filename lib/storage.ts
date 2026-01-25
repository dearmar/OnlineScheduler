// Data storage using Vercel KV
import { kv } from '@vercel/kv';
import { SchedulerConfig, BookedSlot } from './types';
import { v4 as uuidv4 } from 'uuid';

// Default configuration
const defaultConfig: SchedulerConfig = {
  businessName: 'Your Business',
  logo: null,
  primaryColor: '#1a1a2e',
  accentColor: '#4f46e5',
  startHour: 9,
  endHour: 17,
  timezone: 'America/New_York',
  outlookEmail: '',
  outlookConnected: false,
  meetingTypes: [
    { id: '1', name: 'Quick Chat', duration: 15, description: 'A brief 15-minute consultation', color: '#10b981' },
    { id: '2', name: 'Standard Meeting', duration: 30, description: 'A focused 30-minute discussion', color: '#4f46e5' },
    { id: '3', name: 'Deep Dive', duration: 60, description: 'An in-depth 60-minute session', color: '#8b5cf6' },
  ],
  bookedSlots: [],
};

// Get scheduler configuration
export async function getConfig(): Promise<SchedulerConfig> {
  try {
    const config = await kv.get<string>('scheduler_config');
    if (config) {
      return { ...defaultConfig, ...JSON.parse(config) };
    }
  } catch (error) {
    console.error('Error fetching config:', error);
  }
  return defaultConfig;
}

// Save scheduler configuration
export async function saveConfig(config: SchedulerConfig): Promise<void> {
  await kv.set('scheduler_config', JSON.stringify(config));
}

// Update partial configuration
export async function updateConfig(updates: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
  const currentConfig = await getConfig();
  const newConfig = { ...currentConfig, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

// Get all bookings
export async function getBookings(): Promise<BookedSlot[]> {
  const config = await getConfig();
  return config.bookedSlots || [];
}

// Get bookings for a specific date
export async function getBookingsForDate(date: string): Promise<BookedSlot[]> {
  const bookings = await getBookings();
  return bookings.filter(b => b.date === date);
}

// Get bookings for a date range
export async function getBookingsInRange(startDate: string, endDate: string): Promise<BookedSlot[]> {
  const bookings = await getBookings();
  return bookings.filter(b => b.date >= startDate && b.date <= endDate);
}

// Add a new booking
export async function addBooking(booking: Omit<BookedSlot, 'id' | 'createdAt'>): Promise<BookedSlot> {
  const config = await getConfig();
  
  const newBooking: BookedSlot = {
    ...booking,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  
  config.bookedSlots = [...(config.bookedSlots || []), newBooking];
  await saveConfig(config);
  
  return newBooking;
}

// Update a booking
export async function updateBooking(id: string, updates: Partial<BookedSlot>): Promise<BookedSlot | null> {
  const config = await getConfig();
  const index = config.bookedSlots?.findIndex(b => b.id === id) ?? -1;
  
  if (index === -1) {
    return null;
  }
  
  config.bookedSlots[index] = { ...config.bookedSlots[index], ...updates };
  await saveConfig(config);
  
  return config.bookedSlots[index];
}

// Delete a booking
export async function deleteBooking(id: string): Promise<boolean> {
  const config = await getConfig();
  const initialLength = config.bookedSlots?.length || 0;
  
  config.bookedSlots = config.bookedSlots?.filter(b => b.id !== id) || [];
  
  if (config.bookedSlots.length < initialLength) {
    await saveConfig(config);
    return true;
  }
  
  return false;
}

// Get a single booking by ID
export async function getBookingById(id: string): Promise<BookedSlot | null> {
  const bookings = await getBookings();
  return bookings.find(b => b.id === id) || null;
}

// Check if a time slot is available
export async function isSlotAvailable(date: string, time: string, duration: number): Promise<boolean> {
  const bookings = await getBookingsForDate(date);
  
  const requestedStart = timeToMinutes(time);
  const requestedEnd = requestedStart + duration;
  
  for (const booking of bookings) {
    const bookingStart = timeToMinutes(booking.time);
    const bookingEnd = bookingStart + booking.duration;
    
    // Check for overlap
    if (requestedStart < bookingEnd && requestedEnd > bookingStart) {
      return false;
    }
  }
  
  return true;
}

// Convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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
      if (hour === endHour - 1 && minute + duration > 60) break;
      
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      if (await isSlotAvailable(date, time, duration)) {
        slots.push(time);
      }
    }
  }
  
  return slots;
}

// Get meeting type by ID
export async function getMeetingType(id: string) {
  const config = await getConfig();
  return config.meetingTypes?.find(mt => mt.id === id) || null;
}

// Reset all data (use with caution)
export async function resetData(): Promise<void> {
  await saveConfig(defaultConfig);
}
