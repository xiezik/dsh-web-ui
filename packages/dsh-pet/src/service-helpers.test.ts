import { describe, expect, it } from 'vitest'
import { toolPhase, summarizeArguments, clipSummary, ARG_SUMMARY_MAX } from './service.ts'

describe('toolPhase', () => {
  it('maps known tools onto tool-specific phases', () => {
    expect(toolPhase('webfetch')).toBe('fetching')
    expect(toolPhase('fetch')).toBe('fetching')
    expect(toolPhase('websearch')).toBe('searching')
    expect(toolPhase('edit')).toBe('building')
    expect(toolPhase('write')).toBe('building')
    expect(toolPhase('apply_patch')).toBe('building')
    expect(toolPhase('bash')).toBe('building')
    expect(toolPhase('agent')).toBe('analyzing')
    expect(toolPhase('plan')).toBe('analyzing')
    expect(toolPhase('chat')).toBe('chatting')
  })
  it('falls back to the generic tool phase for unknown tools', () => {
    expect(toolPhase('custom-tool')).toBe('tool')
    expect(toolPhase('unknown')).toBe('tool')
  })
})

describe('summarizeArguments', () => {
  it('extracts the bash command', () => {
    expect(summarizeArguments('{"command":"swift build"}', 'bash')).toBe('swift build')
  })
  it('extracts a preferred field (filePath / query / url)', () => {
    expect(summarizeArguments('{"filePath":"/tmp/a.txt","other":1}', 'edit')).toBe('/tmp/a.txt')
    expect(summarizeArguments('{"query":"dsh pet"}', 'websearch')).toBe('dsh pet')
    expect(summarizeArguments('{"url":"https://example.com"}', 'webfetch')).toBe('https://example.com')
  })
  it('extracts the first string value when no preferred field exists', () => {
    expect(summarizeArguments('{"foo":"bar","n":1}', 'x')).toBe('bar')
  })
  it('returns undefined for non-JSON or empty arguments', () => {
    expect(summarizeArguments('not json', 'bash')).toBeUndefined()
    expect(summarizeArguments('{}', 'bash')).toBeUndefined()
  })
})

describe('clipSummary', () => {
  it('truncates long summaries with an ellipsis', () => {
    const long = 'x'.repeat(ARG_SUMMARY_MAX + 10)
    const clipped = clipSummary(long)
    expect(clipped.length).toBeLessThanOrEqual(ARG_SUMMARY_MAX)
    expect(clipped.endsWith('…')).toBe(true)
  })
  it('keeps short summaries unchanged', () => {
    expect(clipSummary('short')).toBe('short')
  })
})
