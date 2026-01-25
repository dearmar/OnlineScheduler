// Admin authentication utilities
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { kv } from '@vercel/kv';
import { AdminUser, TokenPayload } from './types';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_EXPIRY = '7d';

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Get admin user from storage
export async function getAdminUser(): Promise<AdminUser | null> {
  const user = await kv.get<string>('admin_user');
  return user ? JSON.parse(user) : null;
}

// Save admin user to storage
export async function saveAdminUser(user: AdminUser): Promise<void> {
  await kv.set('admin_user', JSON.stringify(user));
}

// Create initial admin user if doesn't exist
export async function ensureAdminUser(): Promise<void> {
  const existingUser = await getAdminUser();
  
  if (!existingUser) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'changeme123';
    const passwordHash = await hashPassword(initialPassword);
    
    const adminUser: AdminUser = {
      id: uuidv4(),
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    
    await saveAdminUser(adminUser);
    console.log('Initial admin user created');
  }
}

// Authenticate admin user
export async function authenticateAdmin(email: string, password: string): Promise<{ user: AdminUser; token: string } | null> {
  const user = await getAdminUser();
  
  if (!user || user.email !== email) {
    return null;
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  // Update last login
  user.lastLogin = new Date().toISOString();
  await saveAdminUser(user);
  
  const token = generateToken(user.id, user.email);
  
  return { user, token };
}

// Change admin password
export async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const user = await getAdminUser();
  
  if (!user) {
    return false;
  }
  
  const isValid = await verifyPassword(oldPassword, user.passwordHash);
  
  if (!isValid) {
    return false;
  }
  
  user.passwordHash = await hashPassword(newPassword);
  await saveAdminUser(user);
  
  return true;
}

// Middleware helper to get authenticated user from request
export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return verifyToken(token);
}

// Check if request is authenticated
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  return !!user;
}

// Session management
export async function createSession(userId: string): Promise<string> {
  const sessionId = uuidv4();
  const sessionData = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  
  await kv.set(`session:${sessionId}`, JSON.stringify(sessionData), {
    ex: 7 * 24 * 60 * 60, // 7 days in seconds
  });
  
  return sessionId;
}

export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await kv.get<string>(`session:${sessionId}`);
  
  if (!session) {
    return false;
  }
  
  const sessionData = JSON.parse(session);
  return new Date(sessionData.expiresAt) > new Date();
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await kv.del(`session:${sessionId}`);
}
