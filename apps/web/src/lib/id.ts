/**
 * Random identifier. `crypto.randomUUID` only exists in secure contexts, so
 * fall back to getRandomValues when the game is opened over plain http (LAN testing).
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
