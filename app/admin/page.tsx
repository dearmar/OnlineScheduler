'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SchedulerConfig, MeetingType } from '@/lib/types';

// Admin User interface
interface AdminUserDisplay {
  id: string;
  email: string;
  name?: string;
  slug?: string;
  mustResetPassword?: boolean;
  createdAt: string;
  lastLogin?: string;
}

// Icon Components
const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20,6 9,17 4,12"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17,8 12,3 7,8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const LogOutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16,17 21,12 16,7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// Format time for display
const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

// Loading component for Suspense
function AdminLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
    </div>
  );
}

// Main admin content component
function AdminPageContent() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [config, setConfig] = useState<Partial<SchedulerConfig> | null>(null);
  const [activeTab, setActiveTab] = useState('branding');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Password reset states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [resetPasswordForm, setResetPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [tokenResetForm, setTokenResetForm] = useState({ newPassword: '', confirmPassword: '' });
  
  // Current user info
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name?: string; slug?: string } | null>(null);

  // Check for URL params (reset token, messages)
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const reset = searchParams.get('reset');
    if (success) showToast(success, 'success');
    if (error) showToast(error, 'error');
    if (reset) {
      setResetToken(reset);
      setIsLoading(false);
    }
  }, [searchParams]);

  // Check authentication on load
  useEffect(() => {
    if (resetToken) return; // Skip auth check if handling reset token
    
    fetch(`/api/auth/verify?_t=${Date.now()}`, { 
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setIsAuthenticated(true);
          loadConfig();
          loadCurrentUser();
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [resetToken]);

  const loadConfig = async () => {
    try {
      // Add timestamp to bust cache
      const response = await fetch(`/api/config?_t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };
  
  const loadCurrentUser = async () => {
    try {
      const response = await fetch(`/api/auth/me?_t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      const data = await response.json();
      if (data.success) {
        setCurrentUser(data.data);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (data.data.mustResetPassword) {
          // User must reset their password
          setMustResetPassword(true);
          setResetPasswordForm({ ...resetPasswordForm, currentPassword: loginForm.password });
        } else {
          setIsAuthenticated(true);
          loadConfig();
          loadCurrentUser();
        }
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'An error occurred');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setForgotPasswordSent(true);
      } else {
        setLoginError(data.error || 'Failed to send reset email');
      }
    } catch (error: any) {
      setLoginError(error.message || 'An error occurred');
    }
  };

  const handleForcePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }
    
    if (resetPasswordForm.newPassword.length < 8) {
      setLoginError('Password must be at least 8 characters');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: resetPasswordForm.currentPassword,
          newPassword: resetPasswordForm.newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMustResetPassword(false);
        setIsAuthenticated(true);
        loadConfig();
        loadCurrentUser();
        showToast('Password updated successfully!');
      } else {
        setLoginError(data.error || 'Failed to reset password');
      }
    } catch (error: any) {
      setLoginError(error.message || 'An error occurred');
    }
  };

  const handleTokenPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (tokenResetForm.newPassword !== tokenResetForm.confirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }
    
    if (tokenResetForm.newPassword.length < 8) {
      setLoginError('Password must be at least 8 characters');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          newPassword: tokenResetForm.newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResetToken(null);
        showToast('Password reset successfully! Please log in.');
        // Clear URL params
        window.history.replaceState({}, '', '/admin');
      } else {
        setLoginError(data.error || 'Failed to reset password');
      }
    } catch (error: any) {
      setLoginError(error.message || 'An error occurred');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setConfig(null);
    setMustResetPassword(false);
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveConfig = async (updates: Partial<SchedulerConfig>) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        showToast('Settings saved!');
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="w-10 h-10 border-3 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Token-based Password Reset Screen (from email link)
  if (resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white">
              <CalendarIcon />
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Reset Password</h1>
            <p className="text-slate-400 mt-2">Enter your new password</p>
          </div>
          
          <form onSubmit={handleTokenPasswordReset} className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
            {loginError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {loginError}
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={tokenResetForm.newPassword}
                  onChange={(e) => setTokenResetForm({ ...tokenResetForm, newPassword: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={tokenResetForm.confirmPassword}
                  onChange={(e) => setTokenResetForm({ ...tokenResetForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Reset Password
              </button>
            </div>
          </form>
          
          <p className="text-center text-slate-500 text-sm mt-6">
            <button onClick={() => { setResetToken(null); window.history.replaceState({}, '', '/admin'); }} className="text-indigo-400 hover:text-indigo-300">
              ← Back to login
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Force Password Reset Screen (after login with temp password)
  if (mustResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 text-white">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Set New Password</h1>
            <p className="text-slate-400 mt-2">You must change your temporary password</p>
          </div>
          
          <form onSubmit={handleForcePasswordReset} className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
            {loginError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {loginError}
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">New Password</label>
                <input
                  type="password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="Enter new password (min 8 characters)"
                  required
                  minLength={8}
                />
              </div>
              
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Set Password & Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!isAuthenticated) {
    // Forgot Password Screen
    if (showForgotPassword) {
      if (forgotPasswordSent) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
            <div className="w-full max-w-md">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-4 text-white">
                  <MailIcon />
                </div>
                <h1 className="text-2xl font-bold text-white font-display">Check Your Email</h1>
                <p className="text-slate-400 mt-2">We've sent password reset instructions to:</p>
                <p className="text-indigo-400 mt-1 font-medium">{forgotPasswordEmail}</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
                <p className="text-slate-400 text-sm mb-6">
                  Click the link in the email to reset your password. The link expires in 24 hours.
                </p>
                <button
                  onClick={() => { setShowForgotPassword(false); setForgotPasswordSent(false); setForgotPasswordEmail(''); }}
                  className="text-indigo-400 hover:text-indigo-300 text-sm"
                >
                  ← Back to login
                </button>
              </div>
            </div>
          </div>
        );
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white">
                <MailIcon />
              </div>
              <h1 className="text-2xl font-bold text-white font-display">Forgot Password</h1>
              <p className="text-slate-400 mt-2">Enter your email to receive reset instructions</p>
            </div>
            
            <form onSubmit={handleForgotPassword} className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
              {loginError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {loginError}
                </div>
              )}
              
              <div className="space-y-5">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
            
            <p className="text-center text-slate-500 text-sm mt-6">
              <button onClick={() => { setShowForgotPassword(false); setLoginError(''); }} className="text-indigo-400 hover:text-indigo-300">
                ← Back to login
              </button>
            </p>
          </div>
        </div>
      );
    }
    
    // Standard Login Screen
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white">
              <CalendarIcon />
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Admin Login</h1>
            <p className="text-slate-400 mt-2">Sign in to manage your scheduler</p>
          </div>
          
          <form onSubmit={handleLogin} className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
            {loginError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {loginError}
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="admin@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
              
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setLoginError(''); }}
                className="w-full text-center text-slate-400 hover:text-indigo-400 text-sm transition-colors"
              >
                Forgot your password?
              </button>
            </div>
          </form>
          
          <p className="text-center text-slate-500 text-sm mt-6">
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              ← Back to booking page
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = config?.primaryColor || '#1a1a2e';
  const accentColor = config?.accentColor || '#4f46e5';

  const tabs = [
    { id: 'branding', label: 'Branding', icon: '✦' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'meetings', label: 'Meeting Types', icon: '⏱' },
    { id: 'outlook', label: 'Outlook', icon: '📧' },
    { id: 'users', label: 'Users', icon: '👥' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
          >
            <CalendarIcon />
          </div>
          <span className="text-lg font-semibold text-white font-display">
            {config?.businessName || 'Scheduler'} Admin
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
          >
            <CalendarIcon /> View Booking
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
          >
            <LogOutIcon /> Logout
          </button>
        </div>
      </nav>

      <main className="pt-16 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-bold text-white font-display mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-400">Configure your scheduling experience</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-xl w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white/3 rounded-2xl border border-white/10 p-8 animate-slide-in">
          {/* Branding Tab */}
          {activeTab === 'branding' && config && (
            <BrandingTab config={config} onSave={saveConfig} isSaving={isSaving} accentColor={accentColor} primaryColor={primaryColor} userSlug={currentUser?.slug} />
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && config && (
            <CalendarTab config={config} onSave={saveConfig} isSaving={isSaving} accentColor={accentColor} primaryColor={primaryColor} />
          )}

          {/* Meetings Tab */}
          {activeTab === 'meetings' && config && (
            <MeetingsTab config={config} onSave={saveConfig} isSaving={isSaving} accentColor={accentColor} primaryColor={primaryColor} />
          )}

          {/* Outlook Tab */}
          {activeTab === 'outlook' && config && (
            <OutlookTab config={config} showToast={showToast} accentColor={accentColor} primaryColor={primaryColor} />
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <UsersTab showToast={showToast} accentColor={accentColor} primaryColor={primaryColor} />
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl text-white text-sm font-medium shadow-2xl animate-slide-in flex items-center gap-3 ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        >
          {toast.type === 'success' && <CheckIcon />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Branding Tab Component
function BrandingTab({ config, onSave, isSaving, accentColor, primaryColor, userSlug }: {
  config: Partial<SchedulerConfig>;
  onSave: (updates: Partial<SchedulerConfig>) => Promise<void>;
  isSaving: boolean;
  accentColor: string;
  primaryColor: string;
  userSlug?: string;
}) {
  const [local, setLocal] = useState({
    businessName: config.businessName || '',
    logo: config.logo || null,
    primaryColor: config.primaryColor || '#1a1a2e',
    accentColor: config.accentColor || '#4f46e5',
  });
  const [copied, setCopied] = useState(false);
  
  const bookingUrl = userSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${userSlug}` : '';
  
  const copyBookingUrl = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLocal({ ...local, logo: ev.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      {/* Booking URL Section */}
      {userSlug && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl p-6 border border-indigo-500/20">
          <label className="block text-white text-sm font-medium mb-2">Your Booking URL</label>
          <p className="text-slate-400 text-sm mb-4">Share this link with clients to let them book appointments with you.</p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={bookingUrl}
              readOnly
              className="flex-1 px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white font-mono text-sm"
            />
            <button
              onClick={copyBookingUrl}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <CheckIcon /> Copied!
                </>
              ) : (
                'Copy Link'
              )}
            </button>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Preview
            </a>
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-slate-400 text-sm font-medium mb-3">Business Name</label>
        <input
          type="text"
          value={local.businessName}
          onChange={(e) => setLocal({ ...local, businessName: e.target.value })}
          className="w-full max-w-md px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 transition-all outline-none"
        />
      </div>

      <div>
        <label className="block text-slate-400 text-sm font-medium mb-3">Logo</label>
        <div className="flex items-center gap-5">
          {local.logo ? (
            <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden">
              <img src={local.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center text-slate-500">
              <UploadIcon />
            </div>
          )}
          <div className="flex gap-3">
            <label className="px-5 py-2.5 rounded-lg bg-white/10 text-white cursor-pointer text-sm font-medium hover:bg-white/15 transition-colors">
              Upload Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
            {local.logo && (
              <button
                onClick={() => setLocal({ ...local, logo: null })}
                className="px-5 py-2.5 rounded-lg border border-white/20 text-slate-400 text-sm hover:text-white transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        <div>
          <label className="block text-slate-400 text-sm font-medium mb-3">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={local.primaryColor}
              onChange={(e) => setLocal({ ...local, primaryColor: e.target.value })}
              className="w-12 h-12 rounded-xl border-0 cursor-pointer"
            />
            <input
              type="text"
              value={local.primaryColor}
              onChange={(e) => setLocal({ ...local, primaryColor: e.target.value })}
              className="w-28 px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-sm font-medium mb-3">Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={local.accentColor}
              onChange={(e) => setLocal({ ...local, accentColor: e.target.value })}
              className="w-12 h-12 rounded-xl border-0 cursor-pointer"
            />
            <input
              type="text"
              value={local.accentColor}
              onChange={(e) => setLocal({ ...local, accentColor: e.target.value })}
              className="w-28 px-3 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onSave(local)}
        disabled={isSaving}
        className="px-8 py-3.5 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
        style={{ 
          background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
          boxShadow: `0 4px 20px ${accentColor}40`
        }}
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Calendar Tab Component
function CalendarTab({ config, onSave, isSaving, accentColor, primaryColor }: {
  config: Partial<SchedulerConfig>;
  onSave: (updates: Partial<SchedulerConfig>) => Promise<void>;
  isSaving: boolean;
  accentColor: string;
  primaryColor: string;
}) {
  const [local, setLocal] = useState({
    startHour: config.startHour || 9,
    endHour: config.endHour || 17,
    timezone: config.timezone || 'America/New_York',
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-8">
      <div>
        <label className="block text-slate-400 text-sm font-medium mb-3">Available Hours</label>
        <div className="flex items-center gap-4">
          <div>
            <span className="block text-slate-500 text-xs mb-1.5">Start Time</span>
            <select
              value={local.startHour}
              onChange={(e) => setLocal({ ...local, startHour: parseInt(e.target.value) })}
              className="px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white cursor-pointer min-w-[140px]"
            >
              {hours.map(h => (
                <option key={h} value={h} className="bg-slate-800">
                  {formatTime(h, 0)}
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-500 pt-6">to</span>
          <div>
            <span className="block text-slate-500 text-xs mb-1.5">End Time</span>
            <select
              value={local.endHour}
              onChange={(e) => setLocal({ ...local, endHour: parseInt(e.target.value) })}
              className="px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white cursor-pointer min-w-[140px]"
            >
              {hours.map(h => (
                <option key={h} value={h} className="bg-slate-800">
                  {formatTime(h, 0)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-slate-400 text-sm font-medium mb-3">Timezone</label>
        <select
          value={local.timezone}
          onChange={(e) => setLocal({ ...local, timezone: e.target.value })}
          className="px-4 py-3.5 rounded-xl border border-white/15 bg-white/5 text-white cursor-pointer min-w-[300px]"
        >
          <option value="America/New_York" className="bg-slate-800">Eastern Time (ET)</option>
          <option value="America/Chicago" className="bg-slate-800">Central Time (CT)</option>
          <option value="America/Denver" className="bg-slate-800">Mountain Time (MT)</option>
          <option value="America/Los_Angeles" className="bg-slate-800">Pacific Time (PT)</option>
          <option value="Europe/London" className="bg-slate-800">London (GMT/BST)</option>
          <option value="Europe/Paris" className="bg-slate-800">Paris (CET)</option>
          <option value="Asia/Tokyo" className="bg-slate-800">Tokyo (JST)</option>
        </select>
      </div>

      <button
        onClick={() => onSave(local)}
        disabled={isSaving}
        className="px-8 py-3.5 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
        style={{ 
          background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
          boxShadow: `0 4px 20px ${accentColor}40`
        }}
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Meetings Tab Component
function MeetingsTab({ config, onSave, isSaving, accentColor, primaryColor }: {
  config: Partial<SchedulerConfig>;
  onSave: (updates: Partial<SchedulerConfig>) => Promise<void>;
  isSaving: boolean;
  accentColor: string;
  primaryColor: string;
}) {
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>(config.meetingTypes || []);
  const [editingId, setEditingId] = useState<string | null>(null);

  const colors = ['#10b981', '#4f46e5', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

  const addMeetingType = () => {
    const newType: MeetingType = {
      id: Date.now().toString(),
      name: 'New Meeting',
      duration: 30,
      description: 'Meeting description',
      color: colors[meetingTypes.length % colors.length],
    };
    setMeetingTypes([...meetingTypes, newType]);
    setEditingId(newType.id);
  };

  const updateMeetingType = (id: string, field: keyof MeetingType, value: any) => {
    setMeetingTypes(meetingTypes.map(mt =>
      mt.id === id ? { ...mt, [field]: value } : mt
    ));
  };

  const deleteMeetingType = (id: string) => {
    setMeetingTypes(meetingTypes.filter(mt => mt.id !== id));
  };

  return (
    <div className="space-y-6">
      {meetingTypes.map((mt, index) => (
        <div
          key={mt.id}
          className={`p-6 rounded-2xl border bg-white/2 transition-all ${
            editingId === mt.id ? 'border-indigo-500' : 'border-white/10'
          }`}
        >
          {editingId === mt.id ? (
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-slate-500 text-xs mb-1.5">Name</label>
                  <input
                    type="text"
                    value={mt.name}
                    onChange={(e) => updateMeetingType(mt.id, 'name', e.target.value)}
                    className="w-full px-3 py-3 rounded-lg border border-white/15 bg-white/5 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1.5">Duration</label>
                  <select
                    value={mt.duration}
                    onChange={(e) => updateMeetingType(mt.id, 'duration', parseInt(e.target.value))}
                    className="px-3 py-3 rounded-lg border border-white/15 bg-white/5 text-white text-sm cursor-pointer"
                  >
                    <option value={15} className="bg-slate-800">15 minutes</option>
                    <option value={30} className="bg-slate-800">30 minutes</option>
                    <option value={60} className="bg-slate-800">60 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1.5">Color</label>
                  <input
                    type="color"
                    value={mt.color}
                    onChange={(e) => updateMeetingType(mt.id, 'color', e.target.value)}
                    className="w-11 h-11 rounded-lg border-0 cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 text-xs mb-1.5">Description</label>
                <input
                  type="text"
                  value={mt.description}
                  onChange={(e) => updateMeetingType(mt.id, 'description', e.target.value)}
                  className="w-full px-3 py-3 rounded-lg border border-white/15 bg-white/5 text-white text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                >
                  Done
                </button>
                <button
                  onClick={() => deleteMeetingType(mt.id)}
                  className="px-5 py-2.5 rounded-lg border border-white/20 text-red-400 text-sm flex items-center gap-2 hover:bg-red-500/10"
                >
                  <TrashIcon /> Delete
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingId(mt.id)}
              className="flex items-center gap-4 cursor-pointer"
            >
              <div className="w-2 h-16 rounded" style={{ background: mt.color }} />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-1">{mt.name}</h3>
                <p className="text-slate-500 text-sm">{mt.description}</p>
              </div>
              <div
                className="px-4 py-2 rounded-full text-sm font-semibold"
                style={{ background: `${mt.color}20`, color: mt.color }}
              >
                {mt.duration} min
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addMeetingType}
        className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 text-slate-500 flex items-center justify-center gap-2 text-sm font-medium hover:border-white/30 hover:text-slate-400 transition-colors"
      >
        <PlusIcon /> Add Meeting Type
      </button>

      <button
        onClick={() => onSave({ meetingTypes })}
        disabled={isSaving}
        className="px-8 py-3.5 rounded-xl text-white font-semibold transition-all disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
          boxShadow: `0 4px 20px ${accentColor}40`
        }}
      >
        {isSaving ? 'Saving...' : 'Save Meeting Types'}
      </button>
    </div>
  );
}

// Outlook Tab Component
function OutlookTab({ config, showToast, accentColor, primaryColor }: {
  config: Partial<SchedulerConfig>;
  showToast: (message: string, type: 'success' | 'error') => void;
  accentColor: string;
  primaryColor: string;
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const connected = config.outlookConnected;

  const handleConnect = () => {
    setIsConnecting(true);
    window.location.href = '/api/auth/microsoft';
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/auth/microsoft/disconnect', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        showToast('Outlook disconnected', 'success');
        window.location.reload();
      } else {
        showToast(data.error || 'Failed to disconnect', 'error');
      }
    } catch (error: any) {
      console.error('Disconnect error:', error);
      showToast(error.message || 'An error occurred', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div
        className={`p-6 rounded-2xl flex items-center gap-4 ${
          connected
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-white/2 border border-white/10'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${
            connected ? 'bg-emerald-500' : 'bg-white/10'
          }`}
        >
          {connected ? <CheckIcon /> : <MailIcon />}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">
            {connected ? 'Outlook Connected' : 'Connect Outlook'}
          </h3>
          <p className="text-slate-500 text-sm">
            {connected ? config.outlookEmail : 'Link your Outlook calendar to sync bookings'}
          </p>
        </div>
        {connected && (
          <button
            onClick={handleDisconnect}
            className="px-5 py-2.5 rounded-lg border border-white/20 text-slate-400 text-sm hover:text-white transition-colors"
          >
            Disconnect
          </button>
        )}
      </div>

      {!connected && (
        <>
          <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <p className="text-slate-300 text-sm leading-relaxed">
              <strong className="text-white">How it works:</strong> Connecting your Microsoft account allows the scheduler to automatically create calendar events when clients book meetings, check your availability in real-time, and send meeting invitations through Outlook.
            </p>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-8 py-3.5 rounded-xl text-white font-semibold transition-all flex items-center gap-3 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
              boxShadow: `0 4px 20px ${accentColor}40`
            }}
          >
            {isConnecting && (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect with Microsoft'}
          </button>
        </>
      )}
    </div>
  );
}

// Users Tab Component
function UsersTab({ showToast, accentColor, primaryColor }: {
  showToast: (message: string, type: 'success' | 'error') => void;
  accentColor: string;
  primaryColor: string;
}) {
  const [users, setUsers] = useState<AdminUserDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState<{ email: string; tempPassword: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastCreatedUser({ email: newUser.email, tempPassword: data.data.tempPassword });
        setNewUser({ email: '', name: '' });
        setShowAddForm(false);
        loadUsers();
        showToast('User created successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to create user', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        loadUsers();
        showToast('User deleted successfully', 'success');
      } else {
        showToast(data.error || 'Failed to delete user', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Admin Users</h2>
          <p className="text-slate-400 text-sm mt-1">Manage who can access the admin dashboard</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-5 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 transition-all"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
          }}
        >
          <PlusIcon /> Add User
        </button>
      </div>

      {/* Temp Password Display */}
      {lastCreatedUser && (
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-amber-400 font-semibold mb-2">Temporary Password Created</h3>
              <p className="text-slate-300 text-sm mb-3">
                Share this temporary password with <strong className="text-white">{lastCreatedUser.email}</strong>:
              </p>
              <div className="bg-slate-900/50 px-4 py-3 rounded-lg font-mono text-lg text-amber-400 tracking-wider">
                {lastCreatedUser.tempPassword}
              </div>
              <p className="text-slate-400 text-xs mt-3">
                The user will be required to change this password on first login. An email has also been sent with these instructions.
              </p>
            </div>
            <button
              onClick={() => setLastCreatedUser(null)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Add New Admin User</h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              A temporary password will be generated and emailed to the user. They will be required to change it on first login.
            </p>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isAdding}
                className="px-5 py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${primaryColor})` }}
              >
                {isAdding ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewUser({ email: '', name: '' }); }}
                className="px-5 py-2.5 rounded-xl border border-white/20 text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left text-slate-400 text-sm font-medium px-5 py-4">User</th>
              <th className="text-left text-slate-400 text-sm font-medium px-5 py-4">Status</th>
              <th className="text-left text-slate-400 text-sm font-medium px-5 py-4">Created</th>
              <th className="text-left text-slate-400 text-sm font-medium px-5 py-4">Last Login</th>
              <th className="text-right text-slate-400 text-sm font-medium px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-white/3 transition-colors">
                <td className="px-5 py-4">
                  <div>
                    <p className="text-white font-medium">{user.name || 'Admin'}</p>
                    <p className="text-slate-400 text-sm">{user.email}</p>
                  </div>
                </td>
                <td className="px-5 py-4">
                  {user.mustResetPassword ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                      Pending Reset
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-400 text-sm">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-5 py-4 text-slate-400 text-sm">
                  {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                </td>
                <td className="px-5 py-4 text-right">
                  {users.length > 1 && (
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete user"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          No admin users found.
        </div>
      )}
    </div>
  );
}

// Default export with Suspense wrapper
export default function AdminPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminPageContent />
    </Suspense>
  );
}
