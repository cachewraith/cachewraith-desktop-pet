import { describe, expect, it } from 'vitest';

import { FALLBACK_RESPONSES, pickFallbackResponse, randomFallbackResponse } from './fallback';

describe('pickFallbackResponse', () => {
  it('answers greetings with an introduction', () => {
    expect(pickFallbackResponse('hello there', 0)).toContain('CacheWraith');
    expect(pickFallbackResponse('Hi!', 3)).toContain('CacheWraith');
  });

  it('answers thanks politely', () => {
    expect(pickFallbackResponse('thanks a lot', 0)).toContain('Anytime');
  });

  it('cycles the pool deterministically by seed', () => {
    expect(pickFallbackResponse('what now', 0)).toBe(FALLBACK_RESPONSES[0]);
    expect(pickFallbackResponse('what now', 3)).toBe(FALLBACK_RESPONSES[3]);
    expect(pickFallbackResponse('what now', FALLBACK_RESPONSES.length)).toBe(FALLBACK_RESPONSES[0]);
  });

  it('handles negative seeds safely', () => {
    expect(FALLBACK_RESPONSES).toContain(pickFallbackResponse('hm', -7));
  });

  it('random variant always returns a known response for neutral input', () => {
    for (let i = 0; i < 20; i++) {
      const reply = randomFallbackResponse('tell me something');
      expect(FALLBACK_RESPONSES).toContain(reply);
    }
  });
});
