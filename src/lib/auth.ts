import * as jose from 'jose';
import { cookies } from 'next/headers';

// User type definition
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

// JWT payload type
export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Secret key for JWT signing
const SECRET_KEY =
  process.env.JWT_SECRET || 'd360-intel-v2-9f8a2c4e7b1d6053';

const secret = new TextEncoder().encode(SECRET_KEY);

/**
 * Sign a JWT token with the provided payload
 */
export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return token;
}

/**
 * Verify a JWT token and return its payload
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jose.jwtVerify(token, secret);
    return {
      id: verified.payload.id as string,
      email: verified.payload.email as string,
      name: verified.payload.name as string,
      role: verified.payload.role as string,
      iat: verified.payload.iat,
      exp: verified.payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Get the current user session from cookies
 */
export async function getSession(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('delta_token')?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

/**
 * Set the authentication token in cookies
 */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('delta_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

/**
 * Clear the authentication cookie
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('delta_token');
}
