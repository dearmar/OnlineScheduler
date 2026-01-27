'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SchedulerConfig, MeetingType, BookedSlot } from '@/lib/types';

// Icon Components
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const ChevronLeft = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9,6 15,12 9,18"/>
  </svg>
);

// Utility functions
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
};

const getDaysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

interface TimeSlot {
  time: string;
  display: string;
}

export default function BookingPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [config, setConfig] = useState<Partial<SchedulerConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({ name: '', email: '', notes: '' });
  const [isBooking, setIsBooking] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Load config for this user
  useEffect(() => {
    fetch(`/api/config?user=${slug}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig(data.data);
        } else if (data.error === 'User not found') {
          setNotFound(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  // Load available slots when date changes
  useEffect(() => {
    if (selectedDate && selectedMeeting) {
      setLoadingSlots(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      fetch(`/api/availability?user=${slug}&date=${dateStr}&duration=${selectedMeeting.duration}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAvailableSlots(data.data.slots);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingSlots(false));
    }
  }, [selectedDate, selectedMeeting]);

  const handleBooking = async () => {
    if (!bookingDetails.name || !bookingDetails.email || !selectedDate || !selectedTime || !selectedMeeting) return;
    
    setIsBooking(true);
    setError(null);
    
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: slug,
          date: selectedDate.toISOString().split('T')[0],
          time: selectedTime.time,
          duration: selectedMeeting.duration,
          meetingType: selectedMeeting.name,
          clientName: bookingDetails.name,
          clientEmail: bookingDetails.email,
          notes: bookingDetails.notes,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBookingComplete(true);
      } else {
        setError(data.error || 'Failed to create booking');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedMeeting(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setBookingDetails({ name: '', email: '', notes: '' });
    setBookingComplete(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-slate-300 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-slate-700 mb-2">Scheduler Not Found</h2>
          <p className="text-slate-500 mb-6">The booking page you're looking for doesn't exist.</p>
          <Link href="/" className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
        <p className="text-slate-600">Failed to load configuration</p>
      </div>
    );
  }

  const primaryColor = config.primaryColor || '#1a1a2e';
  const accentColor = config.accentColor || '#4f46e5';

  // Booking Complete Screen
  if (bookingComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 z-50">
          <div className="flex items-center gap-3">
            {config.logo ? (
              <img src={config.logo} alt="Logo" className="h-8 object-contain" />
            ) : (
              <div 
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
              >
                <CalendarIcon />
              </div>
            )}
            <span className="text-lg font-semibold font-display" style={{ color: primaryColor }}>
              {config.businessName}
            </span>
          </div>
          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors text-sm">
            <SettingsIcon /> Admin
          </Link>
        </nav>

        <main className="pt-16 max-w-xl mx-auto px-6 py-20 text-center animate-fade-in">
          <div 
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-white animate-checkmark"
            style={{ 
              background: `linear-gradient(135deg, ${accentColor}, #10b981)`,
              boxShadow: `0 20px 60px ${accentColor}40`
            }}
          >
            <CheckIcon />
          </div>
          
          <h1 className="text-3xl font-bold mb-3 font-display" style={{ color: primaryColor }}>
            Booking Confirmed!
          </h1>
          
          <p className="text-slate-500 text-lg mb-10">
            Your meeting has been scheduled. A confirmation email has been sent to {bookingDetails.email}.
          </p>
          
          <div className="bg-white rounded-2xl p-8 shadow-lg text-left mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-2 h-10 rounded" style={{ background: selectedMeeting?.color }} />
              <div>
                <h3 className="font-semibold text-lg" style={{ color: primaryColor }}>
                  {selectedMeeting?.name}
                </h3>
                <p className="text-slate-500 text-sm">{selectedMeeting?.duration} minutes</p>
              </div>
            </div>
            
            <div className="flex gap-6 text-slate-600">
              <div className="flex items-center gap-2">
                <CalendarIcon />
                <span>{selectedDate && formatDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <ClockIcon />
                <span>{selectedTime?.display}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={resetBooking}
            className="px-8 py-3.5 rounded-xl text-white font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: accentColor }}
          >
            Book Another Meeting
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          {config.logo ? (
            <img src={config.logo} alt="Logo" className="h-8 object-contain" />
          ) : (
            <div 
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
            >
              <CalendarIcon />
            </div>
          )}
          <span className="text-lg font-semibold font-display" style={{ color: primaryColor }}>
            {config.businessName}
          </span>
        </div>
        <Link href="/admin" className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors text-sm">
          <SettingsIcon /> Admin
        </Link>
      </nav>

      <main className="pt-16 max-w-5xl mx-auto px-6 py-10 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 font-display" style={{ color: primaryColor }}>
            Schedule a Meeting
          </h1>
          <p className="text-slate-500 text-lg">
            Choose a meeting type and select your preferred time
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center gap-2 mb-12">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="h-3 rounded-full transition-all duration-300"
              style={{
                width: s === step ? '48px' : '12px',
                background: s <= step ? accentColor : '#e2e8f0',
              }}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Select Meeting Type */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-6 text-center" style={{ color: primaryColor }}>
              Select Meeting Type
            </h2>
            
            <div className="space-y-4">
              {config.meetingTypes?.map((mt, index) => (
                <div
                  key={mt.id}
                  onClick={() => {
                    setSelectedMeeting(mt);
                    setStep(2);
                  }}
                  className="p-6 rounded-2xl bg-white border-2 border-transparent cursor-pointer flex items-center gap-5 shadow-md hover:shadow-lg transition-all card-hover animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = mt.color;
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent';
                  }}
                >
                  <div className="w-2 h-16 rounded" style={{ background: mt.color }} />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1" style={{ color: primaryColor }}>
                      {mt.name}
                    </h3>
                    <p className="text-slate-500 text-sm">{mt.description}</p>
                  </div>
                  <div 
                    className="px-5 py-2.5 rounded-full text-sm font-semibold"
                    style={{ background: `${mt.color}15`, color: mt.color }}
                  >
                    {mt.duration} min
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Calendar */}
            <div className="bg-white rounded-2xl p-7 shadow-lg animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft />
                </button>
                <h3 className="font-semibold text-lg" style={{ color: primaryColor }}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight />
                </button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center p-2 text-slate-400 text-xs font-semibold">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = getDaysInMonth(year, month);
                  const days = [];
                  
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} />);
                  }
                  
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const isPast = date < today;
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                    const isToday = date.toDateString() === today.toDateString();
                    const isDisabled = isPast || isWeekend;
                    
                    days.push(
                      <button
                        key={day}
                        onClick={() => !isDisabled && setSelectedDate(date)}
                        disabled={isDisabled}
                        className="aspect-square rounded-lg font-medium transition-all"
                        style={{
                          border: isToday ? `2px solid ${accentColor}` : 'none',
                          background: isSelected ? accentColor : (isDisabled ? 'transparent' : '#fff'),
                          color: isSelected ? '#fff' : (isDisabled ? '#cbd5e1' : primaryColor),
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          fontWeight: isSelected || isToday ? '600' : '400',
                        }}
                      >
                        {day}
                      </button>
                    );
                  }
                  
                  return days;
                })()}
              </div>
            </div>

            {/* Time Slots */}
            <div className="bg-white rounded-2xl p-7 shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-semibold text-lg mb-5" style={{ color: primaryColor }}>
                {selectedDate ? formatDate(selectedDate) : 'Select a Date'}
              </h3>
              
              {selectedDate ? (
                loadingSlots ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-2">
                    {availableSlots.map((slot, index) => (
                      <button
                        key={slot.time}
                        onClick={() => {
                          setSelectedTime(slot);
                          setStep(3);
                        }}
                        className="p-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium transition-all hover:border-indigo-400 hover:bg-indigo-50 animate-slide-up"
                        style={{ color: primaryColor, animationDelay: `${index * 0.02}s` }}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-10">
                    No available times for this date
                  </p>
                )
              ) : (
                <p className="text-slate-400 text-center py-10">
                  Please select a date to see available times
                </p>
              )}
            </div>
            
            {/* Back Button */}
            <div className="md:col-span-2">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center gap-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft /> Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Enter Details */}
        {step === 3 && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-lg animate-slide-up">
              {/* Meeting Summary */}
              <div 
                className="p-5 rounded-xl mb-7 flex items-center gap-4"
                style={{ background: `${selectedMeeting?.color}15` }}
              >
                <div className="w-1.5 h-12 rounded" style={{ background: selectedMeeting?.color }} />
                <div className="flex-1">
                  <h4 className="font-semibold mb-1" style={{ color: primaryColor }}>
                    {selectedMeeting?.name}
                  </h4>
                  <div className="flex gap-4 text-slate-500 text-sm">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon /> {selectedDate && formatDate(selectedDate)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ClockIcon /> {selectedTime?.display}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-5">
                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={bookingDetails.name}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">
                    Your Email *
                  </label>
                  <input
                    type="email"
                    value={bookingDetails.email}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 text-sm font-medium mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={bookingDetails.notes}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, notes: e.target.value })}
                    placeholder="Any additional information..."
                    rows={3}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none resize-y"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center gap-2 font-medium hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft /> Back
                  </button>
                  <button
                    onClick={handleBooking}
                    disabled={!bookingDetails.name || !bookingDetails.email || isBooking}
                    className="flex-1 px-8 py-3.5 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: (!bookingDetails.name || !bookingDetails.email)
                        ? '#e2e8f0'
                        : `linear-gradient(135deg, ${accentColor}, ${selectedMeeting?.color})`,
                      color: (!bookingDetails.name || !bookingDetails.email) ? '#94a3b8' : '#fff',
                      boxShadow: (!bookingDetails.name || !bookingDetails.email)
                        ? 'none'
                        : `0 4px 20px ${accentColor}40`,
                    }}
                  >
                    {isBooking && (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {isBooking ? 'Scheduling...' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
