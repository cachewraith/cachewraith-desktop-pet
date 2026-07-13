import { describe, expect, it } from 'vitest';

import { buildExport, parseImport } from './importExport';

describe('buildExport', () => {
  it('clamps values and trims the name', () => {
    const data = buildExport({
      name: '  Spooky  ',
      happiness: 300,
      energy: -5,
      hunger: 42,
      experience: 101.6,
    });
    expect(data.pet.name).toBe('Spooky');
    expect(data.pet.happiness).toBe(100);
    expect(data.pet.energy).toBe(0);
    expect(data.pet.experience).toBe(102);
    expect(data.format).toBe('cachewraith-export');
  });
});

describe('parseImport', () => {
  const valid = JSON.stringify(
    buildExport({ name: 'Wisp', happiness: 60, energy: 70, hunger: 30, experience: 100 })
  );

  it('accepts a valid export and derives the level', () => {
    const result = parseImport(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pet.name).toBe('Wisp');
      expect(result.level).toBe(3);
    }
  });

  it('rejects malformed JSON', () => {
    expect(parseImport('{oops').ok).toBe(false);
  });

  it('rejects wrong format markers', () => {
    expect(parseImport(JSON.stringify({ format: 'other', version: 1, pet: {} })).ok).toBe(false);
  });

  it('rejects future versions', () => {
    const data = JSON.parse(valid);
    data.version = 99;
    expect(parseImport(JSON.stringify(data)).ok).toBe(false);
  });

  it('rejects non-numeric stats', () => {
    const data = JSON.parse(valid);
    data.pet.happiness = 'high';
    const result = parseImport(JSON.stringify(data));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('happiness');
    }
  });

  it('rejects a missing pet object and empty names', () => {
    expect(parseImport(JSON.stringify({ format: 'cachewraith-export', version: 1 })).ok).toBe(
      false
    );
    const data = JSON.parse(valid);
    data.pet.name = '   ';
    expect(parseImport(JSON.stringify(data)).ok).toBe(false);
  });

  it('clamps out-of-range imported values instead of trusting them', () => {
    const data = JSON.parse(valid);
    data.pet.hunger = 4000;
    const result = parseImport(JSON.stringify(data));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pet.hunger).toBe(100);
    }
  });
});
