import { describe, expect, it } from 'vitest'

import { redactHeaders } from './redaction'

describe('redactHeaders (secrets policy, spec decision 32)', () => {
  it('masks Authorization / Cookie request values so tokens never reach readable lanes', () => {
    // Arrange
    const requestHeaders = {
      Authorization: 'Bearer super-secret-token',
      Cookie: 'sid=abc123',
      Accept: 'application/json',
    }

    // Act
    const result = redactHeaders(requestHeaders, 'request')

    // Assert
    expect(result.redacted).toEqual({
      Authorization: '[REDACTED]',
      Cookie: '[REDACTED]',
      Accept: 'application/json',
    })
    expect(result.enclaveEntries).toEqual([])
  })

  it('matches secret header names case-insensitively (CDP header casing varies)', () => {
    // Arrange
    const requestHeaders = { COOKIE: 'sid=abc123' }

    // Act
    const result = redactHeaders(requestHeaders, 'request')

    // Assert
    expect(result.redacted).toEqual({ COOKIE: '[REDACTED]' })
  })

  it('moves Set-Cookie response values into the enclave and masks the readable copy', () => {
    // Arrange
    const responseHeaders = {
      'Set-Cookie': 'session=xyz789; HttpOnly',
      'Content-Type': 'text/html',
    }

    // Act
    const result = redactHeaders(responseHeaders, 'response')

    // Assert
    expect(result.redacted).toEqual({
      'Set-Cookie': '[REDACTED]',
      'Content-Type': 'text/html',
    })
    expect(result.enclaveEntries).toEqual([
      { header: 'set-cookie', value: 'session=xyz789; HttpOnly' },
    ])
  })

  it('leaves Authorization untouched on responses (only request direction redacts it)', () => {
    // Arrange
    const responseHeaders = { Authorization: 'value-echoed-by-server' }

    // Act
    const result = redactHeaders(responseHeaders, 'response')

    // Assert
    expect(result.redacted).toEqual({ Authorization: 'value-echoed-by-server' })
    expect(result.enclaveEntries).toEqual([])
  })
})
