import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installBrowserStubs } from '../setup/browser-stub.ts'

installBrowserStubs()

import { APP_NAME, API_URL, PLANS, PLAN_PRICES, LINKS } from '../../src/lib/constants.ts'

test('APP_NAME is the expected brand string', () => {
  assert.equal(APP_NAME, 'NeuroTek AI')
})

test('API_URL falls back to production URL when env is absent', () => {
  // Under plain Node, import.meta.env is undefined → fallback triggers.
  assert.equal(API_URL, 'https://mixpiloteai-production.up.railway.app')
})

test('API_URL uses https scheme', () => {
  assert.ok(API_URL.startsWith('https://'), `expected https URL, got ${API_URL}`)
})

test('PLANS object has all four expected tier ids', () => {
  assert.equal(PLANS.FREE, 'free')
  assert.equal(PLANS.PRO, 'pro')
  assert.equal(PLANS.STUDIO, 'studio')
  assert.equal(PLANS.LABEL, 'label')
})

test('PLANS has exactly four keys', () => {
  assert.deepEqual(Object.keys(PLANS).sort(), ['FREE', 'LABEL', 'PRO', 'STUDIO'])
})

test('PLAN_PRICES has both monthly and annual for each paid tier', () => {
  const expected = [
    'pro_monthly', 'pro_annual',
    'studio_monthly', 'studio_annual',
    'label_monthly', 'label_annual',
  ]
  for (const key of expected) {
    assert.ok(key in PLAN_PRICES, `PLAN_PRICES missing key: ${key}`)
  }
})

test('PLAN_PRICES values are positive integer cents', () => {
  for (const [k, v] of Object.entries(PLAN_PRICES)) {
    assert.equal(typeof v, 'number', `${k} not a number`)
    assert.ok(Number.isInteger(v), `${k}=${v} not an integer`)
    assert.ok(v > 0, `${k}=${v} must be positive`)
  }
})

test('PLAN_PRICES: annual price beats 12× monthly for every tier', () => {
  const tiers = ['pro', 'studio', 'label'] as const
  for (const tier of tiers) {
    const monthly = PLAN_PRICES[`${tier}_monthly` as keyof typeof PLAN_PRICES]
    const annual = PLAN_PRICES[`${tier}_annual` as keyof typeof PLAN_PRICES]
    assert.ok(
      annual < monthly * 12,
      `${tier}: annual (${annual}) should be cheaper than 12× monthly (${monthly * 12})`,
    )
  }
})

test('PLAN_PRICES: higher-tier monthly is more expensive', () => {
  assert.ok(PLAN_PRICES.pro_monthly < PLAN_PRICES.studio_monthly)
  assert.ok(PLAN_PRICES.studio_monthly < PLAN_PRICES.label_monthly)
})

test('LINKS contains all expected external link keys', () => {
  for (const key of ['discord', 'twitter', 'github', 'docs'] as const) {
    assert.ok(key in LINKS, `LINKS missing key: ${key}`)
  }
})

test('LINKS values are all safe https URLs', () => {
  for (const [k, v] of Object.entries(LINKS)) {
    assert.equal(typeof v, 'string', `${k} not a string`)
    assert.ok(v.startsWith('https://'), `${k}=${v} must be https`)
  }
})

test('LINKS.github points to the mixpiloteai org', () => {
  assert.ok(LINKS.github.includes('mixpiloteai'), `unexpected github URL: ${LINKS.github}`)
})

test('LINKS.docs has a docs subdomain', () => {
  assert.ok(LINKS.docs.includes('docs.'), `expected docs subdomain, got ${LINKS.docs}`)
})
