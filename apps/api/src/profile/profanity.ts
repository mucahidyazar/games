/**
 * Small English + Turkish nickname filter. Not exhaustive by design: it stops
 * the obvious cases without the false positives of aggressive matching.
 *
 * A nickname is normalised — lowercased, accents and Turkish letters folded
 * (ş→s, ı→i), leetspeak mapped (0→o 1→i 3→e 4→a 5→s 7→t @→a) and every
 * non-letter stripped — then checked two ways:
 *  - BLOCKED_ANYWHERE words are rejected wherever they appear ("xXfuckXx").
 *  - BLOCKED_WORDS are short words that hide inside innocent ones ("class",
 *    "Nazım"), so they are rejected only as a whole word or the whole name.
 */

const BLOCKED_ANYWHERE: readonly string[] = [
  // English
  'fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'rapist',
  'pussy', 'penis', 'vagina', 'dildo', 'porn', 'hitler', 'asshole', 'bastard', 'twat', 'wanker',
  // Turkish (folded: ş→s, ı→i, ö→o …)
  'siktir', 'sikik', 'sikis', 'sikerim', 'orospu', 'oruspu', 'yarrak', 'yarak', 'amcik', 'aminako',
  'pezevenk', 'kahpe', 'gavat', 'yavsak', 'serefsiz', 'ibne', 'kaltak', 'surtuk', 'gotveren', 'tassak',
]

const BLOCKED_WORDS: readonly string[] = [
  // English
  'ass', 'dick', 'cock', 'rape', 'nazi', 'fag', 'cum', 'tit', 'tits', 'sex', 'kkk',
  // Turkish
  'amk', 'aq', 'sik', 'pic', 'pust',
]

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a' }

/** Lowercase, fold accents and Turkish letters, map leetspeak. Keeps separators for word splitting. */
function fold(nickname: string): string {
  return nickname
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ı/g, 'i')
    .replace(/[013457@]/g, (char) => LEET[char] ?? char)
}

/** The comparison form: folded, with every non-letter removed ("F.u_c-k" → "fuck"). */
export function normalizeForFilter(nickname: string): string {
  return fold(nickname).replace(/[^\p{L}]/gu, '')
}

export function isNicknameAllowed(nickname: string): boolean {
  const compact = normalizeForFilter(nickname)
  if (BLOCKED_ANYWHERE.some((word) => compact.includes(word))) return false
  const words = fold(nickname)
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
  return !BLOCKED_WORDS.some((word) => word === compact || words.includes(word))
}
