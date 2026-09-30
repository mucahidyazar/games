/** Turns a sign-in name into a valid nickname suggestion ("Ada Lovelace!" → "Ada Lovelace"). */
export function suggestNickname(name: string): string {
  const cleaned = name
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[ ._-]+/, '')
    .slice(0, 16)
    .trim()
  return cleaned.length >= 3 ? cleaned : ''
}
