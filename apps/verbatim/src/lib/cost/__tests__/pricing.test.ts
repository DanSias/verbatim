/**
 * Tests for cost/pricing utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getModelPricing, calculateCost, isCostTrackingEnabled } from '../pricing';

describe('Cost Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getModelPricing', () => {
    it('returns pricing for known Gemini model', () => {
      const pricing = getModelPricing('gemini', 'gemini-2.0-flash');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPer1M).toBe(0.10);
      expect(pricing!.outputPer1M).toBe(0.40);
    });

    it('returns pricing for known OpenAI model', () => {
      const pricing = getModelPricing('openai', 'gpt-4o-mini');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPer1M).toBe(0.15);
      expect(pricing!.outputPer1M).toBe(0.60);
    });

    it('returns pricing for known Anthropic model', () => {
      const pricing = getModelPricing('anthropic', 'claude-sonnet-4-20250514');
      expect(pricing).not.toBeNull();
      expect(pricing!.inputPer1M).toBe(3.00);
      expect(pricing!.outputPer1M).toBe(15.00);
    });

    it('returns provider default for unknown model', () => {
      const pricing = getModelPricing('openai', 'unknown-model-xyz');
      expect(pricing).not.toBeNull();
      // Should fall back to OpenAI default
      expect(pricing!.inputPer1M).toBe(0.15);
      expect(pricing!.outputPer1M).toBe(0.60);
    });

    it('matches model prefix for versioned models', () => {
      const pricing = getModelPricing('openai', 'gpt-4o-2024-01-01');
      expect(pricing).not.toBeNull();
      // Should match gpt-4o prefix
      expect(pricing!.inputPer1M).toBe(2.50);
      expect(pricing!.outputPer1M).toBe(10.00);
    });

    it('returns null when cost tracking is disabled', () => {
      process.env.COST_TRACKING_ENABLED = '0';
      // getModelPricing checks env at runtime
      const pricing = getModelPricing('gemini', 'gemini-2.0-flash');
      expect(pricing).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('calculates cost correctly', () => {
      const pricing = { inputPer1M: 1.0, outputPer1M: 2.0 };
      const cost = calculateCost(1000, 500, pricing);
      // 1000/1M * 1.0 + 500/1M * 2.0 = 0.001 + 0.001 = 0.002
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('handles null input tokens', () => {
      const pricing = { inputPer1M: 1.0, outputPer1M: 2.0 };
      const cost = calculateCost(null, 1000, pricing);
      // 0/1M * 1.0 + 1000/1M * 2.0 = 0 + 0.002 = 0.002
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('handles null output tokens', () => {
      const pricing = { inputPer1M: 1.0, outputPer1M: 2.0 };
      const cost = calculateCost(1000, null, pricing);
      // 1000/1M * 1.0 + 0/1M * 2.0 = 0.001 + 0 = 0.001
      expect(cost).toBeCloseTo(0.001, 6);
    });

    it('returns null when both tokens are zero', () => {
      const pricing = { inputPer1M: 1.0, outputPer1M: 2.0 };
      const cost = calculateCost(0, 0, pricing);
      expect(cost).toBeNull();
    });

    it('returns null when pricing is null', () => {
      const cost = calculateCost(1000, 500, null);
      expect(cost).toBeNull();
    });

    it('handles large token counts', () => {
      const pricing = { inputPer1M: 0.15, outputPer1M: 0.60 };
      // 1 million input, 1 million output
      const cost = calculateCost(1_000_000, 1_000_000, pricing);
      // 1 * 0.15 + 1 * 0.60 = 0.75
      expect(cost).toBeCloseTo(0.75, 6);
    });
  });

  describe('isCostTrackingEnabled', () => {
    it('returns true by default', () => {
      delete process.env.COST_TRACKING_ENABLED;
      // isCostTrackingEnabled checks env at runtime
      expect(isCostTrackingEnabled()).toBe(true);
    });

    it('returns false when disabled', () => {
      process.env.COST_TRACKING_ENABLED = '0';
      expect(isCostTrackingEnabled()).toBe(false);
    });

    it('returns true when enabled', () => {
      process.env.COST_TRACKING_ENABLED = '1';
      expect(isCostTrackingEnabled()).toBe(true);
    });
  });
});
