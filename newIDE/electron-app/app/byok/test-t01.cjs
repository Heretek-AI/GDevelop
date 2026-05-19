'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ByokError, ByokErrorCodes } = require('./errors');
const { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } = require('./buildSystemPrompt');

// ── ByokError ─────────────────────────────────────────────────────────

describe('ByokError', () => {
  it('is an instance of Error', () => {
    const err = new ByokError('INVALID_KEY', 'test message');
    assert.ok(err instanceof Error, 'ByokError should extend Error');
  });

  it('stores code and message correctly', () => {
    const err = new ByokError('RATE_LIMITED', 'Too many requests', {
      statusCode: 429,
    });
    assert.strictEqual(err.code, 'RATE_LIMITED');
    assert.strictEqual(err.message, 'Too many requests');
    assert.strictEqual(err.statusCode, 429);
    assert.strictEqual(err.name, 'ByokError');
  });

  it('has all expected error codes', () => {
    const expected = [
      'INVALID_KEY',
      'ENDPOINT_UNREACHABLE',
      'MODEL_NOT_FOUND',
      'RATE_LIMITED',
      'UNKNOWN',
    ];
    for (const code of expected) {
      assert.strictEqual(
        ByokErrorCodes[code],
        code,
        `ByokErrorCodes.${code} should equal '${code}'`
      );
    }
    // Verify frozen
    assert.throws(
      () => { ByokErrorCodes.NEW_CODE = 'NEW'; },
      /object is not extensible|Cannot add property|read.only/i
    );
  });

  it('is exposed as ByokError.codes', () => {
    assert.strictEqual(ByokError.codes, ByokErrorCodes);
  });

  it('serializes to JSON with toJSON()', () => {
    const err = new ByokError('MODEL_NOT_FOUND', 'model xyz not found', {
      statusCode: 404,
    });
    const json = err.toJSON();
    assert.strictEqual(json.code, 'MODEL_NOT_FOUND');
    assert.strictEqual(json.message, 'model xyz not found');
    assert.strictEqual(json.statusCode, 404);
    assert.strictEqual(json.name, 'ByokError');
    assert.ok(typeof json.stack === 'string', 'stack should be a string');
  });

  it('includes cause in toJSON when present', () => {
    const cause = new Error('connection reset');
    const err = ByokError.endpointUnreachable('cannot reach host', { cause });
    const json = err.toJSON();
    assert.strictEqual(json.cause, 'connection reset');
  });

  describe('static factory methods', () => {
    it('invalidKey creates INVALID_KEY error', () => {
      const err = ByokError.invalidKey('bad api key');
      assert.strictEqual(err.code, 'INVALID_KEY');
    });

    it('endpointUnreachable creates ENDPOINT_UNREACHABLE error', () => {
      const err = ByokError.endpointUnreachable('timeout');
      assert.strictEqual(err.code, 'ENDPOINT_UNREACHABLE');
    });

    it('modelNotFound creates MODEL_NOT_FOUND error', () => {
      const err = ByokError.modelNotFound('gpt-missing');
      assert.strictEqual(err.code, 'MODEL_NOT_FOUND');
    });

    it('rateLimited creates RATE_LIMITED error', () => {
      const err = ByokError.rateLimited('rate exceeded');
      assert.strictEqual(err.code, 'RATE_LIMITED');
    });

    it('unknown creates UNKNOWN error', () => {
      const err = ByokError.unknown('something went wrong');
      assert.strictEqual(err.code, 'UNKNOWN');
    });
  });
});

// ── buildSystemPrompt ─────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('returns a string', () => {
    const result = buildSystemPrompt();
    assert.strictEqual(typeof result, 'string');
  });

  it('returns the default system prompt when called with no options', () => {
    const result = buildSystemPrompt();
    assert.strictEqual(result, DEFAULT_SYSTEM_PROMPT);
  });

  it('includes context when provided', () => {
    const result = buildSystemPrompt({ context: 'User is building a platformer game' });
    assert.ok(
      result.includes('User is building a platformer game'),
      'Result should include the provided context'
    );
  });

  it('strips leading/trailing whitespace from context', () => {
    const result = buildSystemPrompt({ context: '  padded  ' });
    assert.ok(result.includes('padded'));
    assert.ok(!result.includes('  padded  '));
  });

  it('includes language preference when provided', () => {
    const result = buildSystemPrompt({ language: 'fr' });
    assert.ok(
      result.includes('Respond in fr language.'),
      'Result should include language preference'
    );
  });

  it('combines context and language', () => {
    const result = buildSystemPrompt({
      context: 'top-down shooter',
      language: 'es',
    });
    assert.ok(result.includes('top-down shooter'), 'should include context');
    assert.ok(result.includes('Respond in es language.'), 'should include language');
  });

  it('ignores empty string context', () => {
    const result = buildSystemPrompt({ context: '   ' });
    assert.strictEqual(result, DEFAULT_SYSTEM_PROMPT);
  });

  it('ignores empty string language', () => {
    const result = buildSystemPrompt({ language: '' });
    assert.strictEqual(result, DEFAULT_SYSTEM_PROMPT);
  });
});
