import { describe, expect, it } from 'vitest';
import { extractJsonObjectString, parseJsonFromLLM } from './json-parse';

describe('parseJsonFromLLM', () => {
  it('parses fenced JSON', () => {
    const raw = 'Here you go:\n```json\n{"a":1}\n```';
    expect(parseJsonFromLLM<{ a: number }>(raw).a).toBe(1);
  });

  it('extracts first object from noisy output', () => {
    const raw = 'prefix {"x":"y"} trailing';
    expect(extractJsonObjectString(raw)).toBe('{"x":"y"}');
  });
});
