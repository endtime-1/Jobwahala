import { describe, expect, it } from 'vitest'
import { isChunkLoadError, shouldAutoReload } from './staleAppRecovery'

describe('isChunkLoadError', () => {
  it('recognises the messages browsers give when a script file has gone', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/Login-1.js'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError('Failed to load module script: Expected a JavaScript module')).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError({ message: 'Failed to fetch dynamically imported module' })).toBe(false)
  })
})

describe('shouldAutoReload', () => {
  it('reloads the first time', () => {
    expect(shouldAutoReload(null, 1_000_000)).toBe(true)
  })

  it('does not reload again within a minute, so a real outage cannot loop', () => {
    expect(shouldAutoReload(1_000_000, 1_030_000)).toBe(false)
  })

  it('allows another attempt after the cooldown', () => {
    expect(shouldAutoReload(1_000_000, 1_061_000)).toBe(true)
  })
})
