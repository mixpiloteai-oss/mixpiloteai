import { Router } from 'express'
import { getLandingContent, getSection, getLastUpdated } from '../lib/cmsManager'

const router = Router()

// GET /api/cms/landing — full landing page content, no-cache
router.get('/landing', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.set('Last-Modified', getLastUpdated())
  res.json({ success: true, data: getLandingContent() })
})

// GET /api/cms/landing/:section — single section
router.get('/landing/:section', (req, res) => {
  const section = getSection(req.params['section'] ?? '')
  if (!section) return res.status(404).json({ error: 'Section not found' })
  res.set('Cache-Control', 'no-store')
  res.json({ success: true, data: section })
})

export default router
