import { describe, expect, it } from 'vitest'
import { normalizeBackendUrl } from '../src/backend-url.ts'

describe('desktop backend URL', () => {
  it('accepts loopback HTTP endpoints', () => {
    expect(normalizeBackendUrl('http://127.0.0.1:3080')).toBe('http://127.0.0.1:3080/')
    expect(normalizeBackendUrl('http://localhost:4173/workbench')).toBe('http://localhost:4173/workbench')
  })

  it('rejects remote, file, and credentialed endpoints', () => {
    expect(() => normalizeBackendUrl('https://example.com')).toThrow('loopback host')
    expect(() => normalizeBackendUrl('file:///tmp/index.html')).toThrow('loopback host')
    expect(() => normalizeBackendUrl('http://user:secret@localhost:3080')).toThrow('credentials')
  })
})
