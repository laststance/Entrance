/**
 * Secrets policy, capture side (spec decision 32): request Authorization/Cookie
 * values never reach disk in readable lanes; response Set-Cookie values move to
 * the sensitive enclave (Mode B needs them, humans don't). Called by
 * TargetSession while writing the network lane.
 */

const REDACTED_PLACEHOLDER = '[REDACTED]'
/** Request headers whose values are secrets and are NOT needed by Mode B (responses replay from the recording). */
const REDACT_REQUEST_HEADERS = ['authorization', 'cookie', 'proxy-authorization']
/** Response headers whose values go to the enclave instead of the readable lane. */
const ENCLAVE_RESPONSE_HEADERS = ['set-cookie']

export interface HeaderRedactionResult {
  /** Headers safe to store in the readable network lane. */
  redacted: Record<string, string>
  /** Header values that moved to the enclave (empty when none). */
  enclaveEntries: Array<{ header: string; value: string }>
}

/**
 * Split headers into a readable (redacted) set and enclave entries.
 * @param headers - raw header map from CDP (case varies)
 * @param direction - request headers redact in place; response headers move to enclave
 * @example redactHeaders({ Cookie: 'sid=abc' }, 'request')
 *          // => { redacted: { Cookie: '[REDACTED]' }, enclaveEntries: [] }
 */
export function redactHeaders(
  headers: Record<string, string>,
  direction: 'request' | 'response',
): HeaderRedactionResult {
  const redacted: Record<string, string> = {}
  const enclaveEntries: Array<{ header: string; value: string }> = []
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase()
    if (direction === 'request' && REDACT_REQUEST_HEADERS.includes(lower)) {
      redacted[name] = REDACTED_PLACEHOLDER
    } else if (direction === 'response' && ENCLAVE_RESPONSE_HEADERS.includes(lower)) {
      redacted[name] = REDACTED_PLACEHOLDER
      enclaveEntries.push({ header: lower, value })
    } else {
      redacted[name] = value
    }
  }
  return { redacted, enclaveEntries }
}
