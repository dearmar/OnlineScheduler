'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Scheduler {
  id: string;
  name: string;
  slug: string;
  businessName: string;
}

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export default function HomePage() {
  const [schedulers, setSchedulers] = useState<Scheduler[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/schedulers', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSchedulers(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="w-10 h-10 border-3 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <CalendarIcon />
          </div>
          <span className="text-lg font-semibold text-white">Online Scheduler</span>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm"
        >
          Admin Login
        </Link>
      </nav>

      <main className="pt-24 pb-16 max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Book an Appointment
          </h1>
          <p className="text-slate-400 text-lg">
            Choose a scheduler below to book your meeting
          </p>
        </div>

        {schedulers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 text-slate-500">
              <CalendarIcon />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Schedulers Available</h2>
            <p className="text-slate-400">
              There are no booking pages available at this time.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {schedulers.map(scheduler => (
              <Link
                key={scheduler.id}
                href={`/book/${scheduler.slug}`}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-all hover:border-indigo-500/50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                    <CalendarIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {scheduler.businessName}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {scheduler.name}
                    </p>
                    <p className="text-indigo-400 text-sm mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      Book now →
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-slate-500 text-sm border-t border-white/5 bg-slate-900/50 backdrop-blur">
        Powered by Online Scheduler
      </footer>
    </div>
  );
}
