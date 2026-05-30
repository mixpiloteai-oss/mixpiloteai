/**
 * Standard response envelope for all API endpoints.
 * ok()  → { success: true,  data, meta? }
 * fail() → { success: false, error, code? }
 */

export interface ApiOk<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiFail {
  success: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiOk<T> | ApiFail

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiOk<T> {
  return meta ? { success: true, data, meta } : { success: true, data }
}

export function fail(error: string, code?: string): ApiFail {
  return code ? { success: false, error, code } : { success: false, error }
}

// HTTP status helpers
export const HTTP = {
  OK:          200,
  CREATED:     201,
  NO_CONTENT:  204,
  BAD_REQUEST: 400,
  UNAUTHORIZED:401,
  FORBIDDEN:   403,
  NOT_FOUND:   404,
  CONFLICT:    409,
  UNPROCESSABLE: 422,
  TOO_MANY:    429,
  SERVER_ERROR:500,
} as const
