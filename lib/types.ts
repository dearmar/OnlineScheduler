// Type definitions for the Calendar Scheduler

export interface MeetingType {
  id: string;
  name: string;
  duration: 15 | 30 | 60;
  description: string;
  color: string;
}

export interface BookedSlot {
  id: string;
  date: string;
  time: string;
  duration: number;
  meetingType: string;
  clientName: string;
  clientEmail: string;
  notes?: string;
  outlookEventId?: string;
  createdAt: string;
}

export interface SchedulerConfig {
  businessName: string;
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  startHour: number;
  endHour: number;
  timezone: string;
  outlookEmail: string;
  outlookConnected: boolean;
  meetingTypes: MeetingType[];
  bookedSlots: BookedSlot[];
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
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
