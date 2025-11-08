/**
 * Unit tests for JSON utilities
 */

import { describe, it, expect } from 'vitest';
import { formatSuccess, formatError, parseJsonInput } from '../../src/utils/json.js';

describe('JSON Utilities', () => {
  describe('formatSuccess', () => {
    it('should format successful response with data', () => {
      const result = formatSuccess({ value: 'test' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.data).toEqual({ value: 'test' });
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.timestamp).toBeDefined();
    });

    it('should include metadata when provided', () => {
      const result = formatSuccess(
        { value: 'test' },
        { server: 'test-server', executionTime: 123 }
      );
      const parsed = JSON.parse(result);

      expect(parsed.metadata.server).toBe('test-server');
      expect(parsed.metadata.executionTime).toBe(123);
    });
  });

  describe('formatError', () => {
    it('should format error from Error object', () => {
      const error = new Error('Test error');
      const result = formatError(error);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('Error');
      expect(parsed.error.message).toBe('Test error');
    });

    it('should format error from string', () => {
      const result = formatError('Test error', 'TEST_ERROR');
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error.code).toBe('TEST_ERROR');
      expect(parsed.error.message).toBe('Test error');
    });

    it('should include error details when provided', () => {
      const result = formatError('Test error', 'TEST_ERROR', { key: 'value' });
      const parsed = JSON.parse(result);

      expect(parsed.error.details).toEqual({ key: 'value' });
    });
  });

  describe('parseJsonInput', () => {
    it('should parse valid JSON', () => {
      const result = parseJsonInput('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parseJsonInput('invalid')).toThrow('Invalid JSON input');
    });
  });
});
