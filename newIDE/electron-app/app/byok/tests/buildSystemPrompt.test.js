'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } = require('../buildSystemPrompt');

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
