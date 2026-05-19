import { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Wraps an async route handler so unhandled Promise rejections
 * are forwarded to Express's next(err) instead of crashing silently.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation()
 *     res.json(ok(data))
 *   }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
