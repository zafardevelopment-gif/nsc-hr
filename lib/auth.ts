import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const COOKIE_NAME = 'nsc_hr_session';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, role_type: user.role_type || 'super_admin', employee_id: user.employee_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    return decoded;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(user: User, remember = false): Promise<string> {
  const token = generateToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7, // 30 days or 7 days
    path: '/',
  });
  return token;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function isLockedOut(loginAttempts: number, lockedUntil: string | null): boolean {
  if (loginAttempts < MAX_LOGIN_ATTEMPTS) return false;
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

export function getNewLockoutTime(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + LOCKOUT_MINUTES);
  return d;
}
