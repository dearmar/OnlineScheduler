// Admin authentication utilities
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql } from './db/client';
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

// Get admin user from database
export async function getAdminUser(): Promise<AdminUser | null> {
  const result = await sql`
    SELECT id, email, password_hash, created_at, last_login
    FROM admin_users
    LIMIT 1
  `;
  
  if (result.length === 0) return null;
  
  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

// Save admin user to database
export async function saveAdminUser(user: AdminUser): Promise<void> {
  await sql`
    INSERT INTO admin_users (id, email, password_hash, created_at, last_login)
    VALUES (${user.id}::uuid, ${user.email}, ${user.passwordHash}, ${user.createdAt}, ${user.lastLogin || null})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      last_login = EXCLUDED.last_login
  `;
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
  const result = await sql`
    SELECT id, email, password_hash, created_at, last_login
    FROM admin_users
    WHERE email = ${email}
    LIMIT 1
  `;
  
  if (result.length === 0) return null;
  
  const user: AdminUser = {
    id: result[0].id,
    email: result[0].email,
    passwordHash: result[0].password_hash,
    createdAt: result[0].created_at,
    lastLogin: result[0].last_login,
  };
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  // Update last login
  await sql`
    UPDATE admin_users 
    SET last_login = CURRENT_TIMESTAMP 
    WHERE id = ${user.id}::uuid
  `;
  
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
  
  const newHash = await hashPassword(newPassword);
  
  await sql`
    UPDATE admin_users 
    SET password_hash = ${newHash}
    WHERE id = ${user.id}::uuid
  `;
  
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

// Session management using database
export async function createSession(userId: string): Promise<string> {
  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  // Note: For full session support, you'd create a sessions table
  // For now, we rely on JWT tokens
  return sessionId;
}

export async function validateSession(sessionId: string): Promise<boolean> {
  // JWT tokens are self-validating
  const payload = verifyToken(sessionId);
  return !!payload;
}

export async function invalidateSession(sessionId: string): Promise<void> {
  // With JWT, we can't truly invalidate tokens without a blacklist
  // For logout, we just clear the cookie on the client side
}
