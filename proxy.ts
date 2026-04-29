import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const COOKIE_NAME = 'nsc_hr_session';

interface JWTPayload {
  id: string;
  username: string;
  role: 'admin' | 'employee';
  employee_id?: string;
}

function getSessionFromRequest(req: NextRequest): JWTPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = getSessionFromRequest(req);

  // Public routes — always accessible
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    // If already logged in, redirect away from login
    if (pathname === '/login' && session) {
      const dest = session.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  // All other routes require auth
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes — require admin role
  if (pathname.startsWith('/admin')) {
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/employee/dashboard', req.url));
    }
  }

  // Employee routes — require employee role
  if (pathname.startsWith('/employee')) {
    if (session.role !== 'employee') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp).*)',
  ],
};
