import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { fail } from '../utils/response'

export interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function createError(message: string, statusCode = 500, code?: string): AppError {
  const err = new Error(message) as AppError
  err.statusCode = statusCode
  if (code) err.code = code
  return err
}

// Must have 4 params for Express to treat as error handler
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const status  = err.statusCode ?? 500
  const message = status < 500 ? err.message : 'Internal server error'

  if (status >= 500) {
    logger.error('Unhandled error', { message: err.message, stack: err.stack })
  }

  res.status(status).json(fail(message, err.code))
}
