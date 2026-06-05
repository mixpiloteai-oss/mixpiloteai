import { Request, Response } from 'express'
import { fail, HTTP } from './response'

type Rule = { required?: boolean; type?: 'string' | 'number' | 'boolean' | 'email'; min?: number; max?: number }
type Schema = Record<string, Rule>

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/**
 * Validates req.body fields against a schema.
 * Returns null if valid, or sends a 400 and returns false.
 *
 * Usage:
 *   if (!validate(req, res, { email: { required: true, type: 'email' }, password: { required: true, min: 8 } })) return
 */
export function validate(req: Request, res: Response, schema: Schema): boolean {
  for (const [field, rule] of Object.entries(schema)) {
    const value = (req.body as Record<string, unknown>)[field]

    if (rule.required && (value === undefined || value === null || value === '')) {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} is required`))
      return false
    }

    if (value === undefined || value === null) continue

    if (rule.type === 'string' && typeof value !== 'string') {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} must be a string`))
      return false
    }
    if (rule.type === 'number' && typeof value !== 'number') {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} must be a number`))
      return false
    }
    if (rule.type === 'email' && (typeof value !== 'string' || !isEmail(value))) {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} must be a valid email`))
      return false
    }
    if (rule.type === 'string' && rule.min !== undefined && (value as string).length < rule.min) {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} must be at least ${rule.min} characters`))
      return false
    }
    if (rule.type === 'string' && rule.max !== undefined && (value as string).length > rule.max) {
      res.status(HTTP.BAD_REQUEST).json(fail(`${field} must be at most ${rule.max} characters`))
      return false
    }
  }
  return true
}
