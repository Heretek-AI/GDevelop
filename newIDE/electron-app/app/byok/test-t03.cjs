'use strict';

/**
 * Tests for callLLM.js — core OpenAI-compatible LLM caller.
 *
 * Strategy: byokConfig.js requires 'electron' (not available outside Electron
 * runtime).  We create a minimal mock for the 'electron' module at a temp path
 * and inject it into require.cache before loading callLLM.  fs-extra is
 * installed via npm and resolves normally from electron-app/app/node_modules.
 *
 * All fetch calls are mocked so we exercise validation, HTTP error mapping,
 * streaming SSE parsing, and request tracking without network access.
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

// ── Pre-require: mock electron module ──────────────────────────────────

const MOCK_ELECTRON_PATH = path.join(os.tmpdir(), 'byok-test-electron-mock.js');

// Remove stale mock from prior runs (if any).
try { require('fs').unlinkSync(MOCK_ELECTRON_PATH); } catch (_) {}

require('fs').writeFileSync(
  MOCK_ELECTRON_PATH,
  `'use strict';
   const path = require('path');
   const TEST_USER_DATA = ${JSON.stringify(path.join(os.tmpdir(), 'byok-test-' + Date.now()))};
   module.exports = {
     app: {
       getPath: (name) => name === 'userData' ? TEST_USER_DATA : path.join(TEST_USER_DATA, name),
     },
   };`
);

// Register the mock in require.cache under the synthetic path.
// We'll also need to ensure callLLM → byokConfig → require('electron')
// resolves to our mock.  We use Module._resolveFilename patching.
const Module = require('module');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return MOCK_ELECTRON_PATH;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

// ── In-memory config ───────────────────────────────────────────────────

/** In-memory store used by the mocked fs-extra.  We mock at the fs level
 *  by replacing fs-extra's readFile/writeJson with in-memory versions
 *  after the module is loaded. */

let _savedConfig = {
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: 'sk-test-key-12345',
  model: 'gpt-4o-mini',
};

// ── Import modules (after electron mock is in place) ────────────────────

// Mock byokConfig's file I/O after it's loaded.
const byokConfig = require('./byokConfig');

// Replace readConfig to return our in-memory config.
mock.method(byokConfig, 'readConfig', async () => ({ ..._savedConfig }));

const { ByokError, ByokErrorCodes } = require('./errors');
const { callLLM, callLLMStream } = require('./callLLM');
const { _reset: resetRequestStore, _size: requestStoreSize } = require('./requestStore');

/** Set the config that readConfig() will return. */
function setTestConfig(overrides) {
  _savedConfig = { ..._savedConfig, ...overrides };
}

// ── Helpers ────────────────────────────────────────────────────────────

/** @type {import('node:test').Mock<typeof fetch>} */
let fetchMock;

let responseMock = null;
let fetchErrorMock = null;

function mockJsonResponse(body, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

function mockStreamResponse(chunks) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader() {
        let idx = 0;
        return {
          read() {
            if (idx >= chunks.length) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return Promise.resolve({ value: encoder.encode(chunks[idx++]), done: false });
          },
          cancel() {},
          releaseLock() {},
        };
      },
    },
    json: async () => ({}),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('callLLM module', () => {
  beforeEach(() => {
    resetRequestStore();
    _savedConfig = {
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test-key-12345',
      model: 'gpt-4o-mini',
    };
    responseMock = null;
    fetchErrorMock = null;

    fetchMock = mock.method(globalThis, 'fetch', async () => {
      if (fetchErrorMock) throw fetchErrorMock;
      return responseMock;
    });
  });

  afterEach(() => {
    mock.reset();
  });

  // ── Exports ────────────────────────────────────────────────────

  describe('exports', () => {
    it('exports callLLM as a function', () => {
      assert.strictEqual(typeof callLLM, 'function');
    });

    it('exports callLLMStream as a function', () => {
      assert.strictEqual(typeof callLLMStream, 'function');
    });
  });

  // ── callLLM validation ─────────────────────────────────────────

  describe('callLLM parameter validation', () => {
    it('throws when messages is missing', async () => {
      await assert.rejects(
        callLLM({}),
        (err) => err instanceof ByokError && err.code === ByokErrorCodes.UNKNOWN
      );
    });

    it('throws when messages is not an array', async () => {
      await assert.rejects(
        callLLM({ messages: 'not an array' }),
        (err) => err instanceof ByokError && err.code === ByokErrorCodes.UNKNOWN
      );
    });

    it('throws when messages is empty', async () => {
      await assert.rejects(
        callLLM({ messages: [] }),
        (err) => err instanceof ByokError && err.code === ByokErrorCodes.UNKNOWN
      );
    });
  });

  // ── callLLMStream validation ────────────────────────────────────

  describe('callLLMStream parameter validation', () => {
    it('throws when onChunk is missing', async () => {
      await assert.rejects(
        callLLMStream({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === ByokErrorCodes.UNKNOWN
      );
    });

    it('throws when onChunk is not a function', async () => {
      await assert.rejects(
        callLLMStream({
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: 'not a function',
        }),
        (err) => err instanceof ByokError && err.code === ByokErrorCodes.UNKNOWN
      );
    });
  });

  // ── callLLM success ───────────────────────────────────────────

  describe('callLLM success', () => {
    it('calls fetch with correct endpoint, method, headers, and body', async () => {
      responseMock = mockJsonResponse({
        id: 'chatcmpl-123',
        choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
      });

      await callLLM({ messages: [{ role: 'user', content: 'Say hello' }] });

      assert.strictEqual(fetchMock.mock.calls.length, 1);
      const [url, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(url, _savedConfig.endpoint);
      assert.strictEqual(init.method, 'POST');
      assert.strictEqual(init.headers['Content-Type'], 'application/json');
      assert.strictEqual(init.headers['Authorization'], 'Bearer sk-test-key-12345');

      const body = JSON.parse(init.body);
      assert.strictEqual(body.model, 'gpt-4o-mini');
      assert.strictEqual(body.stream, false);
      assert.ok(Array.isArray(body.messages));
      assert.strictEqual(body.messages[0].role, 'system');
      assert.strictEqual(body.messages[body.messages.length - 1].role, 'user');
    });

    it('returns parsed JSON response body', async () => {
      const expected = { choices: [{ message: { content: 'Hi!' } }] };
      responseMock = mockJsonResponse(expected);

      const result = await callLLM({ messages: [{ role: 'user', content: 'hi' }] });
      assert.deepStrictEqual(result, expected);
    });

    it('includes AbortSignal in fetch options', async () => {
      responseMock = mockJsonResponse({ choices: [] });
      const ac = new AbortController();

      await callLLM({
        messages: [{ role: 'user', content: 'test' }],
        signal: ac.signal,
      });

      const [, init] = fetchMock.mock.calls[0].arguments;
      assert.ok(init.signal instanceof AbortSignal);
    });
  });

  // ── callLLM request tracking ───────────────────────────────────

  describe('callLLM request tracking', () => {
    it('registers with requestStore when requestId provided', async () => {
      responseMock = mockJsonResponse({ choices: [] });
      await callLLM({
        messages: [{ role: 'user', content: 'test' }],
        requestId: 'req-track-01',
      });
      assert.strictEqual(requestStoreSize(), 1);
    });

    it('does not register when requestId omitted', async () => {
      responseMock = mockJsonResponse({ choices: [] });
      await callLLM({ messages: [{ role: 'user', content: 'test' }] });
      assert.strictEqual(requestStoreSize(), 0);
    });
  });

  // ── callLLM HTTP errors ───────────────────────────────────────

  describe('callLLM HTTP error handling', () => {
    it('maps 401 to INVALID_KEY', async () => {
      responseMock = mockJsonResponse(
        { error: { message: 'Invalid API key' } },
        { status: 401, statusText: 'Unauthorized' }
      );
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'INVALID_KEY' && err.statusCode === 401
      );
    });

    it('maps 404 to MODEL_NOT_FOUND', async () => {
      responseMock = mockJsonResponse(
        { error: { message: 'Model not found' } },
        { status: 404 }
      );
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'MODEL_NOT_FOUND'
      );
    });

    it('maps 429 to RATE_LIMITED', async () => {
      responseMock = mockJsonResponse(
        { error: { message: 'Too many requests' } },
        { status: 429 }
      );
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'RATE_LIMITED'
      );
    });

    it('maps 500 to UNKNOWN', async () => {
      responseMock = mockJsonResponse(
        { message: 'Internal error' },
        { status: 500, statusText: 'Internal Server Error' }
      );
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'UNKNOWN' && err.statusCode === 500
      );
    });

    it('handles non-JSON error response bodies', async () => {
      responseMock = {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => { throw new Error('invalid json'); },
      };
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.message.includes('502')
      );
    });
  });

  // ── callLLM network errors ────────────────────────────────────

  describe('callLLM network errors', () => {
    it('maps fetch TypeError to ENDPOINT_UNREACHABLE', async () => {
      fetchErrorMock = new TypeError('fetch failed');
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'ENDPOINT_UNREACHABLE' && err.message.includes('fetch failed')
      );
    });

    it('maps pre-aborted signal to ENDPOINT_UNREACHABLE', async () => {
      const ac = new AbortController();
      ac.abort();
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }], signal: ac.signal }),
        (err) => err instanceof ByokError && err.code === 'ENDPOINT_UNREACHABLE'
      );
    });
  });

  // ── callLLM missing API key ───────────────────────────────────

  describe('callLLM missing API key', () => {
    it('throws INVALID_KEY when apiKey is empty', async () => {
      setTestConfig({ apiKey: '' });
      await assert.rejects(
        callLLM({ messages: [{ role: 'user', content: 'hi' }] }),
        (err) => err instanceof ByokError && err.code === 'INVALID_KEY'
      );
    });
  });

  // ── callLLMStream success ─────────────────────────────────────

  describe('callLLMStream success', () => {
    it('streams chunks via onChunk and returns accumulated text', async () => {
      responseMock = mockStreamResponse([
        'data: {"id":"c1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"c1","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
        'data: {"id":"c1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]);

      const receivedChunks = [];
      const result = await callLLMStream({
        messages: [{ role: 'user', content: 'Say hello world' }],
        onChunk: (chunk) => receivedChunks.push(chunk),
      });

      assert.strictEqual(result, 'Hello world');
      assert.ok(receivedChunks.length >= 3);
    });

    it('calls fetch with stream: true', async () => {
      responseMock = mockStreamResponse(['data: [DONE]\n\n']);
      await callLLMStream({
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
      });

      const [, init] = fetchMock.mock.calls[0].arguments;
      assert.strictEqual(JSON.parse(init.body).stream, true);
    });

    it('tracks request with requestStore when requestId provided', async () => {
      responseMock = mockStreamResponse(['data: [DONE]\n\n']);
      await callLLMStream({
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
        requestId: 'stream-req-01',
      });
      assert.strictEqual(requestStoreSize(), 1);
    });
  });

  // ── callLLMStream errors ──────────────────────────────────────

  describe('callLLMStream error handling', () => {
    it('maps 401 to INVALID_KEY', async () => {
      responseMock = mockJsonResponse(
        { error: { message: 'Bad key' } },
        { status: 401 }
      );
      await assert.rejects(
        callLLMStream({
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {},
        }),
        (err) => err instanceof ByokError && err.code === 'INVALID_KEY'
      );
    });

    it('maps fetch TypeError to ENDPOINT_UNREACHABLE', async () => {
      fetchErrorMock = new TypeError('network error');
      await assert.rejects(
        callLLMStream({
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {},
        }),
        (err) => err instanceof ByokError && err.code === 'ENDPOINT_UNREACHABLE'
      );
    });

    it('throws INVALID_KEY when apiKey is empty', async () => {
      setTestConfig({ apiKey: '' });
      await assert.rejects(
        callLLMStream({
          messages: [{ role: 'user', content: 'hi' }],
          onChunk: () => {},
        }),
        (err) => err instanceof ByokError && err.code === 'INVALID_KEY'
      );
    });
  });

  // ── SSE parsing ───────────────────────────────────────────────

  describe('SSE parsing', () => {
    it('ignores empty SSE data lines', async () => {
      responseMock = mockStreamResponse([
        'data: \n\n',
        'data: {"choices":[{"index":0,"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
      const result = await callLLMStream({
        messages: [{ role: 'user', content: 'hi' }],
        onChunk: () => {},
      });
      assert.strictEqual(result, 'ok');
    });

    it('handles multiple SSE events in one chunk', async () => {
      responseMock = mockStreamResponse([
        'data: {"choices":[{"index":0,"delta":{"content":"A"}}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"B"}}]}\n\ndata: [DONE]\n\n',
      ]);
      const result = await callLLMStream({
        messages: [{ role: 'user', content: 'test' }],
        onChunk: () => {},
      });
      assert.strictEqual(result, 'AB');
    });

    it('skips malformed JSON SSE lines', async () => {
      responseMock = mockStreamResponse([
        'data: {broken json\n\n',
        'data: {"choices":[{"index":0,"delta":{"content":"recovered"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
      const result = await callLLMStream({
        messages: [{ role: 'user', content: 'test' }],
        onChunk: () => {},
      });
      assert.strictEqual(result, 'recovered');
    });
  });

  // ── System prompt integration ─────────────────────────────────

  describe('system prompt integration', () => {
    it('prepends system prompt as first message', async () => {
      responseMock = mockJsonResponse({ choices: [] });
      await callLLM({
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
          { role: 'user', content: 'how are you' },
        ],
      });

      const [, init] = fetchMock.mock.calls[0].arguments;
      const body = JSON.parse(init.body);
      assert.strictEqual(body.messages[0].role, 'system');
      assert.strictEqual(body.messages[1].content, 'hello');
      assert.strictEqual(body.messages[3].content, 'how are you');
    });
  });

  // ── ByokError IPC serialization ───────────────────────────────

  describe('ByokError toJSON', () => {
    it('toJSON produces IPC-safe shape', () => {
      const err = ByokError.invalidKey('test', { statusCode: 401 });
      const json = err.toJSON();
      assert.strictEqual(json.code, 'INVALID_KEY');
      assert.strictEqual(json.message, 'test');
      assert.strictEqual(json.statusCode, 401);
      assert.strictEqual(json.name, 'ByokError');
    });
  });
});
