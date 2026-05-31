import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseAdvancedCommand } from '../../src/renderer/src/audio/ai/AdvancedCommandParser.ts'

describe('AdvancedCommandParser', () => {
  it('fais une montée acid → intent=acid_ramp, language=fr', () => {
    const result = parseAdvancedCommand('fais une montée acid')
    assert.equal(result.intent, 'acid_ramp')
    assert.ok(result.language === 'fr' || result.language === 'mixed', `Expected fr or mixed, got ${result.language}`)
  })

  it('plus agressif → intent=more_aggressive', () => {
    const result = parseAdvancedCommand('plus agressif')
    assert.equal(result.intent, 'more_aggressive')
  })

  it('rends la basse plus propre → intent=cleaner_bass', () => {
    const result = parseAdvancedCommand('rends la basse plus propre')
    assert.equal(result.intent, 'cleaner_bass')
  })

  it('ajoute groove tribe → intent=add_groove, parameters.style=tribal', () => {
    const result = parseAdvancedCommand('ajoute groove tribe')
    assert.equal(result.intent, 'add_groove')
    assert.equal(result.parameters.style, 'tribal')
  })

  it('humanize hats → intent=humanize, language=en', () => {
    const result = parseAdvancedCommand('humanize hats')
    assert.equal(result.intent, 'humanize')
    assert.ok(result.language === 'en' || result.language === 'mixed', `Expected en or mixed, got ${result.language}`)
  })

  it('plus de dynamique → intent=more_dynamics', () => {
    const result = parseAdvancedCommand('plus de dynamique')
    assert.equal(result.intent, 'more_dynamics')
  })

  it('add buildup 8 bars → intent=add_buildup, parameters.bars=8', () => {
    const result = parseAdvancedCommand('add buildup 8 bars')
    assert.equal(result.intent, 'add_buildup')
    assert.equal(result.parameters.bars, 8)
  })

  it('add drop → intent=add_drop', () => {
    const result = parseAdvancedCommand('add drop')
    assert.equal(result.intent, 'add_drop')
  })

  it('unknown text → intent=unknown, confidence < 0.3', () => {
    const result = parseAdvancedCommand('xyzzy frobble snork')
    assert.equal(result.intent, 'unknown')
    assert.ok(result.confidence < 0.3, `confidence should be < 0.3, got ${result.confidence}`)
  })

  it('exact match returns high confidence (≥0.9)', () => {
    const result = parseAdvancedCommand('humanize hats')
    assert.ok(result.confidence >= 0.9, `Expected confidence >= 0.9, got ${result.confidence}`)
  })

  it('rawText matches input', () => {
    const input = 'add buildup 4 bars'
    const result = parseAdvancedCommand(input)
    assert.equal(result.rawText, input)
  })

  it('contextualHints is an array', () => {
    const result = parseAdvancedCommand('humanize hats')
    assert.ok(Array.isArray(result.contextualHints))
  })

  it('acid ramp (English) → intent=acid_ramp', () => {
    const result = parseAdvancedCommand('acid ramp')
    assert.equal(result.intent, 'acid_ramp')
  })

  it('add breakdown → intent=add_breakdown', () => {
    const result = parseAdvancedCommand('add breakdown')
    assert.equal(result.intent, 'add_breakdown')
  })
})
