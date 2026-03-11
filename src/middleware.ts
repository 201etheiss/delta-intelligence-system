import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

const SECRET_KEY =
  process.env.JWT_SECRET || 'd360-intel-v2-9f8a2c4e7b1d6053';

const secret = new TextEncoder().encode(SECRET_KEY);

/**
 * Verify JWT token
 */
async function verifyToken(token: string): Promise<boolean> {
  try {
    await jose.jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Middleware to protect dashboard routes with authentication
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/login', '/', '/favicon.ico'];

  // Allow Next.js internal routes
  if (pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Check if the route is public
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if the route is in the dashboard
  if (pathname.startsWith('/(dashboard)') || pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('delta_token')?.value;

    // No token found
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verify token
    const isValid = await verifyToken(token);

    if (!isValid) {
      // Token is invalid or expired
      const response = NextResponse.redirect(new URL('/login', request.url));
      // Clear the invalid token
      response.cookies.delete('delta_token');
      return response;
    }
  }

  return NextResponse.next();
}

/**
 * Configure which routes should be protected by middleware
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
