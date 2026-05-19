'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ByokError, ByokErrorCodes } = require('../errors');

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
