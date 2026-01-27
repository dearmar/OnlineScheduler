// Type definitions for the Calendar Scheduler

// Meeting location types
export type LocationType = 'in_person' | 'phone' | 'virtual';

export interface MeetingType {
  id: string;
  name: string;
  duration: 15 | 30 | 60;
  description: string;
  color: string;
  locationType: LocationType;
  location?: string; // For in_person: physical address, for virtual: meeting link
}

export interface BookedSlot {
  id: string;
  date: string;
  time: string;
  duration: number;
  meetingType: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string; // For phone call meetings
  notes?: string;
  locationType?: LocationType;
  location?: string;
  calendarEventId?: string; // Renamed from outlookEventId to be provider-agnostic
  createdAt: string;
}

// Per-day availability hours
export interface DayAvailability {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface WeeklyAvailability {
  sunday: DayAvailability;
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
}

// Calendar provider types
export type CalendarProvider = 'outlook' | 'google' | 'none';

export interface SchedulerConfig {
  businessName: string;
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  // Legacy single hours (for backwards compatibility)
  startHour: number;
  endHour: number;
  // New per-day availability
  weeklyAvailability?: WeeklyAvailability;
  timezone: string;
  // Calendar provider
  calendarProvider: CalendarProvider;
  // Outlook
  outlookEmail: string;
  outlookConnected: boolean;
  // Google
  googleEmail?: string;
  googleConnected?: boolean;
  meetingTypes: MeetingType[];
  bookedSlots: BookedSlot[];
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  slug?: string;
  passwordHash: string;
  mustResetPassword?: boolean;
  resetToken?: string;
  resetTokenExpires?: string;
  createdBy?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  mustResetPassword?: boolean;
  iat: number;
  exp: number;
}

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

export interface OutlookEvent {
  id?: string;
  subject: string;
  body: {
    contentType: 'HTML' | 'Text';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
    type: 'required' | 'optional';
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'teamsForBusiness';
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: { type: string };
    };
  };
}

export interface WebhookPayload {
  event: 'booking.created' | 'booking.cancelled' | 'booking.updated';
  data: {
    booking: BookedSlot;
    config: Partial<SchedulerConfig>;
  };
  timestamp: string;
  signature?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
