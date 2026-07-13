/**
 * Local fallback replies used when AI is disabled or no API key exists.
 * These are honest local responses — never presented as coming from OpenAI.
 */
export const FALLBACK_RESPONSES: readonly string[] = [
  "I'm awake. What are we building today?",
  "You've got this.",
  'A short break might restore your mana.',
  'I can become smarter after you add an API key in Settings.',
  'The cache spirits approve.',
  'Boo! …Sorry, ghost habits.',
  'Remember to hydrate — even wraiths sip moonlight.',
  'Your taskbar feels cozy today.',
];

const GREETING_PATTERN = /\b(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i;
const THANKS_PATTERN = /\b(thanks|thank you|thx|ty)\b/i;

/**
 * Pick a fallback response. Deterministic for a given (message, seed) pair
 * so it is unit-testable; pass a random seed in production.
 */
export function pickFallbackResponse(userMessage: string, seed: number): string {
  if (GREETING_PATTERN.test(userMessage)) {
    return "Hello! I'm CacheWraith, your desktop ghost. I keep things cozy around the taskbar.";
  }
  if (THANKS_PATTERN.test(userMessage)) {
    return 'Anytime. Haunting your desktop is my pleasure.';
  }
  const index = Math.abs(Math.floor(seed)) % FALLBACK_RESPONSES.length;
  return FALLBACK_RESPONSES[index];
}

export function randomFallbackResponse(userMessage: string): string {
  return pickFallbackResponse(userMessage, Math.floor(Math.random() * FALLBACK_RESPONSES.length));
}
