// ─── CommandParser.test.ts ─────────────────────────────────────────────────────

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCommand } from '../../src/renderer/src/audio/ai/CommandParser.ts'

describe('CommandParser / intent detection', () => {
  it('"fais un kick tribe" → intent=generate_pattern, target=kick, style=tribe', () => {
    const result = parseCommand('fais un kick tribe')
    assert.equal(result.intent, 'generate_pattern', `intent: ${result.intent}`)
    assert.equal(result.target, 'kick',             `target: ${result.target}`)
    assert.equal(result.style,  'tribe',            `style: ${result.style}`)
  })

  it('"humanize les hats" → intent=humanize, target=hihat', () => {
    const result = parseCommand('humanize les hats')
    assert.equal(result.intent, 'humanize', `intent: ${result.intent}`)
    assert.equal(result.target, 'hihat',    `target: ${result.target}`)
  })

  it('"ajoute une montée" → intent=add_buildup', () => {
    const result = parseCommand('ajoute une montée')
    assert.equal(result.intent, 'add_buildup', `intent: ${result.intent}`)
  })

  it('"fais un drop" → intent=add_drop', () => {
    const result = parseCommand('fais un drop')
    assert.equal(result.intent, 'add_drop', `intent: ${result.intent}`)
  })

  it('"rends la basse plus agressive" → intent=modify_pattern, target=bass, direction=increase, style=aggressive', () => {
    const result = parseCommand('rends la basse plus agressive')
    assert.equal(result.intent,    'modify_pattern', `intent: ${result.intent}`)
    assert.equal(result.target,    'bass',           `target: ${result.target}`)
    assert.equal(result.direction, 'increase',       `direction: ${result.direction}`)
    assert.equal(result.style,     'aggressive',     `style: ${result.style}`)
  })

  it('"analyse le projet" → intent=analyze', () => {
    const result = parseCommand('analyse le projet')
    assert.equal(result.intent, 'analyze', `intent: ${result.intent}`)
  })

  it('"mets le bpm à 130" → intent=set_bpm, value=130', () => {
    const result = parseCommand('mets le bpm à 130')
    assert.equal(result.intent, 'set_bpm', `intent: ${result.intent}`)
    assert.equal(result.value,  130,       `value: ${result.value}`)
  })

  it('empty string → intent=unknown', () => {
    const result = parseCommand('')
    assert.equal(result.intent, 'unknown', `intent: ${result.intent}`)
  })
})
