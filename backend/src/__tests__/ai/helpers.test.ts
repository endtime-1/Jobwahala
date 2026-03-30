import { describe, it, expect } from 'vitest';
import {
  extractOutputText,
  extractFirstJsonObject,
  sanitizeProposalField,
  sanitizeStringArray,
  clampScore,
  extractComparableNumber,
  daysUntilIsoDate,
  parseSkills,
} from '../../services/ai/helpers';

// ── extractOutputText ─────────────────────────────────────────────────

describe('extractOutputText', () => {
  it('returns output_text when present as a string', () => {
    expect(extractOutputText({ output_text: '  hello world  ' })).toBe('hello world');
  });

  it('returns empty string for missing payload', () => {
    expect(extractOutputText(null)).toBe('');
    expect(extractOutputText(undefined)).toBe('');
    expect(extractOutputText({})).toBe('');
  });

  it('concatenates content from output array items', () => {
    const payload = {
      output: [
        {
          content: [
            { type: 'output_text', text: 'part one' },
            { type: 'image', text: 'ignored' },
            { type: 'output_text', text: 'part two' },
          ],
        },
      ],
    };

    expect(extractOutputText(payload)).toBe('part one\n\npart two');
  });

  it('returns empty when output array has no text content', () => {
    const payload = {
      output: [
        { content: [{ type: 'image', text: 'ignored' }] },
      ],
    };

    expect(extractOutputText(payload)).toBe('');
  });
});

// ── extractFirstJsonObject ────────────────────────────────────────────

describe('extractFirstJsonObject', () => {
  it('extracts a JSON object from text with surrounding content', () => {
    const text = 'Here is your result: {"score": 85, "headline": "Great"} hope that helps';
    const result = extractFirstJsonObject(text);
    expect(result).toEqual({ score: 85, headline: 'Great' });
  });

  it('returns null for text with no braces', () => {
    expect(extractFirstJsonObject('no json here')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(extractFirstJsonObject('{bad json}')).toBeNull();
  });

  it('handles nested objects', () => {
    const text = '{"outer": {"inner": true}}';
    expect(extractFirstJsonObject(text)).toEqual({ outer: { inner: true } });
  });
});

// ── sanitizeProposalField ─────────────────────────────────────────────

describe('sanitizeProposalField', () => {
  it('trims and returns valid strings', () => {
    expect(sanitizeProposalField('  hello  ')).toBe('hello');
  });

  it('returns fallback for non-string values', () => {
    expect(sanitizeProposalField(42, 'default')).toBe('default');
    expect(sanitizeProposalField(null, 'default')).toBe('default');
    expect(sanitizeProposalField(undefined, 'default')).toBe('default');
  });

  it('returns fallback for empty/whitespace strings', () => {
    expect(sanitizeProposalField('   ', 'fallback')).toBe('fallback');
  });
});

// ── sanitizeStringArray ───────────────────────────────────────────────

describe('sanitizeStringArray', () => {
  it('filters and trims string arrays', () => {
    expect(sanitizeStringArray(['  a  ', '', '  b  '], ['x'])).toEqual(['a', 'b']);
  });

  it('returns fallback for non-array values', () => {
    expect(sanitizeStringArray('not array', ['fallback'])).toEqual(['fallback']);
    expect(sanitizeStringArray(null, ['fallback'])).toEqual(['fallback']);
  });

  it('returns fallback when all items are empty', () => {
    expect(sanitizeStringArray(['', '  '], ['fallback'])).toEqual(['fallback']);
  });

  it('caps results at 6 entries', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(sanitizeStringArray(input, [])).toHaveLength(6);
  });
});

// ── clampScore ────────────────────────────────────────────────────────

describe('clampScore', () => {
  it('rounds and clamps values within 0-100', () => {
    expect(clampScore(85.7)).toBe(86);
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
  });
});

// ── extractComparableNumber ───────────────────────────────────────────

describe('extractComparableNumber', () => {
  it('extracts numbers from salary strings', () => {
    expect(extractComparableNumber('$50,000')).toBe(50000);
    expect(extractComparableNumber('GHS 3,500/month')).toBe(3500);
  });

  it('returns null for empty/null values', () => {
    expect(extractComparableNumber(null)).toBeNull();
    expect(extractComparableNumber('')).toBeNull();
    expect(extractComparableNumber('   ')).toBeNull();
  });

  it('returns null for strings with no numbers', () => {
    expect(extractComparableNumber('negotiable')).toBeNull();
  });
});

// ── daysUntilIsoDate ──────────────────────────────────────────────────

describe('daysUntilIsoDate', () => {
  it('returns positive days for future dates', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilIsoDate(future)).toBe(5);
  });

  it('returns negative days for past dates', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysUntilIsoDate(past)).toBeLessThanOrEqual(-2);
  });

  it('returns null for null/empty values', () => {
    expect(daysUntilIsoDate(null)).toBeNull();
    expect(daysUntilIsoDate('')).toBeNull();
  });

  it('returns null for invalid date strings', () => {
    expect(daysUntilIsoDate('not-a-date')).toBeNull();
  });
});

// ── parseSkills ───────────────────────────────────────────────────────

describe('parseSkills', () => {
  it('splits comma-separated skills and trims', () => {
    expect(parseSkills('React, Node.js, TypeScript')).toEqual(['React', 'Node.js', 'TypeScript']);
  });

  it('returns empty array for null/undefined', () => {
    expect(parseSkills(null)).toEqual([]);
    expect(parseSkills(undefined)).toEqual([]);
  });

  it('filters out empty segments', () => {
    expect(parseSkills('React,,, Node.js')).toEqual(['React', 'Node.js']);
  });
});
