/**
 * Sanitize GEMINI_API_KEY from env.
 * Railway pastes sometimes include accidental junk like ` PORT=3001`, which breaks
 * fetch Headers (invalid header value).
 */
export function resolveGeminiApiKey(raw: string | undefined | null): string | null {
  if (!raw) return null;

  let key = raw.trim();
  if (/^GEMINI_API_KEY=/i.test(key)) {
    key = key.replace(/^GEMINI_API_KEY=/i, '').trim();
  }

  // Multi-line / multi-var paste: keep only the first token.
  key = (key.split(/\s+/)[0] ?? '').trim();
  key = key.replace(/^["']|["']$/g, '');

  if (!key || key === 'PASTE_KEY_HERE') return null;

  // Must be header-safe (no whitespace / control chars).
  if (!/^[\x21-\x7E]+$/.test(key)) return null;

  return key;
}
