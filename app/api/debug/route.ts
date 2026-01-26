import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const { password } = await request.json();
  
  // Get the stored hash
  const result = await sql`SELECT email, password_hash FROM admin_users LIMIT 1`;
  
  if (result.length === 0) {
    return NextResponse.json({ error: 'No admin user found' });
  }
  
  const storedHash = result[0].password_hash;
  
  // Test the password
  const isValid = await bcrypt.compare(password, storedHash);
  
  // Generate a new hash for comparison
  const newHash = await bcrypt.hash(password, 12);
  
  return NextResponse.json({
    email: result[0].email,
    storedHashPrefix: storedHash?.substring(0, 30),
    passwordTested: password,
    isValid,
    newHashForThisPassword: newHash
  });
}
