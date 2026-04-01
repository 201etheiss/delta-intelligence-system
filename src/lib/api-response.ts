import { NextResponse } from 'next/server';

/**
 * Standardized API response helpers.
 * All routes should use these instead of raw NextResponse.json().
 */

interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    cached?: boolean;
    fetchedAt?: string;
  };
}

interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(data: T, meta?: ApiSuccessResponse['meta'], status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  }, { status });
}

export function apiError(
  message: string,
  status = 500,
  code?: string,
  details?: unknown,
): NextResponse<ApiResponse<never>> {
  return NextResponse.json({
    success: false,
    error: message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  }, { status });
}

// Common error shortcuts
export const api401 = (msg = 'Authentication required') => apiError(msg, 401, 'UNAUTHORIZED');
export const api403 = (msg = 'Access denied') => apiError(msg, 403, 'FORBIDDEN');
export const api404 = (msg = 'Not found') => apiError(msg, 404, 'NOT_FOUND');
export const api400 = (msg: string) => apiError(msg, 400, 'BAD_REQUEST');
export const api429 = (msg = 'Rate limit exceeded') => apiError(msg, 429, 'RATE_LIMITED');
export const api500 = (msg = 'Internal server error') => apiError(msg, 500, 'INTERNAL_ERROR');

/**
 * Wrap an async handler with standardized error catching.
 * Prevents internal error details from leaking to clients.
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[API Error] ${request.method} ${request.url}:`, message);
      // Don't leak internal error details in production
      const safeMessage = process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : message;
      return api500(safeMessage);
    }
  };
}
