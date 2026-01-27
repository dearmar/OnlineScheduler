// Admin authentication utilities
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
export function generateToken(userId: string, email: string, mustResetPassword: boolean = false): string {
  return jwt.sign(
    { userId, email, mustResetPassword },
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

// Generate random password
export function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Generate reset token
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Get all admin users
export async function getAllAdminUsers(): Promise<AdminUser[]> {
  const result = await sql`
    SELECT id, email, name, must_reset_password, created_by, created_at, last_login
    FROM admin_users
    ORDER BY created_at DESC
  `;
  
  return result.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: '',
    mustResetPassword: user.must_reset_password,
    createdBy: user.created_by,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  }));
}

// Get admin user by ID
export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const result = await sql`
    SELECT id, email, name, password_hash, must_reset_password, reset_token, reset_token_expires, created_by, created_at, last_login
    FROM admin_users
    WHERE id = ${id}::uuid
  `;
  
  if (result.length === 0) return null;
  
  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.password_hash,
    mustResetPassword: user.must_reset_password,
    resetToken: user.reset_token,
    resetTokenExpires: user.reset_token_expires,
    createdBy: user.created_by,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

// Get admin user by email
export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const result = await sql`
    SELECT id, email, name, password_hash, must_reset_password, reset_token, reset_token_expires, created_by, created_at, last_login
    FROM admin_users
    WHERE email = ${email}
  `;
  
  if (result.length === 0) return null;
  
  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.password_hash,
    mustResetPassword: user.must_reset_password,
    resetToken: user.reset_token,
    resetTokenExpires: user.reset_token_expires,
    createdBy: user.created_by,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

// Get first admin user (for backwards compatibility)
export async function getAdminUser(): Promise<AdminUser | null> {
  const result = await sql`
    SELECT id, email, name, password_hash, must_reset_password, created_at, last_login
    FROM admin_users
    LIMIT 1
  `;
  
  if (result.length === 0) return null;
  
  const user = result[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.password_hash,
    mustResetPassword: user.must_reset_password,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

// Save admin user to database
export async function saveAdminUser(user: AdminUser): Promise<void> {
  await sql`
    INSERT INTO admin_users (id, email, name, password_hash, must_reset_password, created_by, created_at, last_login)
    VALUES (${user.id}::uuid, ${user.email}, ${user.name || null}, ${user.passwordHash}, ${user.mustResetPassword || false}, ${user.createdBy || null}::uuid, ${user.createdAt}, ${user.lastLogin || null})
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash,
      must_reset_password = EXCLUDED.must_reset_password,
      last_login = EXCLUDED.last_login
  `;
}

// Create new admin user with temporary password
export async function createAdminUser(email: string, name: string, createdById: string): Promise<{ user: AdminUser; tempPassword: string }> {
  const existing = await getAdminUserByEmail(email);
  if (existing) {
    throw new Error('Email already exists');
  }
  
  const tempPassword = generateRandomPassword();
  const passwordHash = await hashPassword(tempPassword);
  
  const newUser: AdminUser = {
    id: uuidv4(),
    email,
    name,
    passwordHash,
    mustResetPassword: true,
    createdBy: createdById,
    createdAt: new Date().toISOString(),
  };
  
  await saveAdminUser(newUser);
  
  return { user: newUser, tempPassword };
}

// Delete admin user
export async function deleteAdminUser(id: string, requesterId: string): Promise<boolean> {
  if (id === requesterId) {
    throw new Error('Cannot delete your own account');
  }
  
  const user = await getAdminUserById(id);
  if (!user) {
    throw new Error('User not found');
  }
  
  await sql`DELETE FROM admin_users WHERE id = ${id}::uuid`;
  return true;
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
      name: 'Admin',
      passwordHash,
      mustResetPassword: false,
      createdAt: new Date().toISOString(),
    };
    
    await saveAdminUser(adminUser);
    console.log('Initial admin user created');
  }
}

// Authenticate admin user
export async function authenticateAdmin(email: string, password: string): Promise<{ user: AdminUser; token: string; mustResetPassword: boolean } | null> {
  const user = await getAdminUserByEmail(email);
  
  if (!user) return null;
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  await sql`
    UPDATE admin_users 
    SET last_login = CURRENT_TIMESTAMP 
    WHERE id = ${user.id}::uuid
  `;
  
  const mustResetPassword = user.mustResetPassword || false;
  const token = generateToken(user.id, user.email, mustResetPassword);
  
  return { user, token, mustResetPassword };
}

// Set password reset token
export async function setPasswordResetToken(email: string): Promise<{ resetToken: string; user: AdminUser } | null> {
  const user = await getAdminUserByEmail(email);
  
  if (!user) return null;
  
  const resetToken = generateResetToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await sql`
    UPDATE admin_users 
    SET reset_token = ${resetToken}, reset_token_expires = ${expiresAt.toISOString()}
    WHERE id = ${user.id}::uuid
  `;
  
  return { resetToken, user };
}

// Reset password with token (from email link)
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const result = await sql`
    SELECT id, email, reset_token_expires
    FROM admin_users
    WHERE reset_token = ${token}
  `;
  
  if (result.length === 0) {
    throw new Error('Invalid or expired reset token');
  }
  
  const user = result[0];
  const expires = new Date(user.reset_token_expires);
  
  if (expires < new Date()) {
    throw new Error('Reset token has expired');
  }
  
  const newHash = await hashPassword(newPassword);
  
  await sql`
    UPDATE admin_users 
    SET password_hash = ${newHash}, reset_token = NULL, reset_token_expires = NULL, must_reset_password = false
    WHERE id = ${user.id}::uuid
  `;
  
  return true;
}

// Reset password on login (with temp password)
export async function resetPasswordOnLogin(userId: string, tempPassword: string, newPassword: string): Promise<string> {
  const user = await getAdminUserById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const isValid = await verifyPassword(tempPassword, user.passwordHash);
  
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  const newHash = await hashPassword(newPassword);
  
  await sql`
    UPDATE admin_users 
    SET password_hash = ${newHash}, must_reset_password = false
    WHERE id = ${userId}::uuid
  `;
  
  // Generate new token without mustResetPassword flag
  return generateToken(user.id, user.email, false);
}

// Change admin password (when logged in)
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
  const user = await getAdminUserById(userId);
  
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
    WHERE id = ${userId}::uuid
  `;
  
  return true;
}

// Middleware helper to get authenticated user from request
export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return verifyToken(cookieToken);
  }
  
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
