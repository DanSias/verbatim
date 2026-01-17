/**
 * Unit tests for LLM provider selection logic.
 *
 * Tests provider selection without making real API calls.
 * See Phase 6.1 requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isValidProvider, getLLMConfig, getDefaultProvider } from '../index';

describe('isValidProvider', () => {
  it('returns true for valid provider names', () => {
    expect(isValidProvider('gemini')).toBe(true);
    expect(isValidProvider('openai')).toBe(true);
    expect(isValidProvider('anthropic')).toBe(true);
  });

  it('returns false for invalid provider names', () => {
    expect(isValidProvider('gpt4')).toBe(false);
    expect(isValidProvider('claude')).toBe(false);
    expect(isValidProvider('')).toBe(false);
    expect(isValidProvider('unknown')).toBe(false);
  });

  it('returns false for case-sensitive mismatches', () => {
    expect(isValidProvider('Gemini')).toBe(false);
    expect(isValidProvider('OPENAI')).toBe(false);
    expect(isValidProvider('Anthropic')).toBe(false);
  });
});

describe('getLLMConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns gemini as default provider when LLM_PROVIDER not set', () => {
    delete process.env.LLM_PROVIDER;
    const config = getLLMConfig();
    expect(config.defaultProvider).toBe('gemini');
  });

  it('respects LLM_PROVIDER env var', () => {
    process.env.LLM_PROVIDER = 'openai';
    const config = getLLMConfig();
    expect(config.defaultProvider).toBe('openai');
  });

  it('falls back to gemini for invalid LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'invalid';
    const config = getLLMConfig();
    expect(config.defaultProvider).toBe('gemini');
  });

  it('handles case-insensitive LLM_PROVIDER', () => {
    process.env.LLM_PROVIDER = 'ANTHROPIC';
    const config = getLLMConfig();
    expect(config.defaultProvider).toBe('anthropic');
  });

  it('includes API keys from environment', () => {
    process.env.GOOGLE_API_KEY = 'test-google-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    const config = getLLMConfig();

    expect(config.env.googleApiKey).toBe('test-google-key');
    expect(config.env.openaiApiKey).toBe('test-openai-key');
    expect(config.env.anthropicApiKey).toBe('test-anthropic-key');
  });

  it('includes model overrides from environment', () => {
    process.env.LLM_MODEL_GEMINI = 'gemini-pro';
    process.env.LLM_MODEL_OPENAI = 'gpt-4';
    process.env.LLM_MODEL_ANTHROPIC = 'claude-3-opus';

    const config = getLLMConfig();

    expect(config.env.modelGemini).toBe('gemini-pro');
    expect(config.env.modelOpenai).toBe('gpt-4');
    expect(config.env.modelAnthropic).toBe('claude-3-opus');
  });
});

describe('getDefaultProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns gemini by default', () => {
    delete process.env.LLM_PROVIDER;
    expect(getDefaultProvider()).toBe('gemini');
  });

  it('returns provider from LLM_PROVIDER env', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    expect(getDefaultProvider()).toBe('anthropic');
  });
});
