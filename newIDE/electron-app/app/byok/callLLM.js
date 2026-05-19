'use strict';

/**
 * Core OpenAI-compatible LLM API caller.
 *
 * Provides callLLM (non-streaming) and callLLMStream (streaming) functions that:
 * 1. Read provider configuration via readConfig()
 * 2. Validate credentials and inputs using ByokError typed errors
 * 3. Build OpenAI-compatible request bodies
 * 4. Use native fetch() with AbortSignal from requestStore for cancellation
 * 5. Track in-flight requests via requestStore.createRequest
 * 6. Map HTTP errors, network failures, and timeouts to ByokError types
 *
 * Dependencies:
 * - errors.js        — ByokError with typed error codes
 * - byokConfig.js    — Electron config file persistence (requires Electron app)
 * - requestStore.js  — In-flight request tracker with AbortController
 * - buildSystemPrompt.js — System prompt assembly
 */

const { ByokError } = require('./errors');
const { readConfig } = require('./byokConfig');
const {
  createRequest,
  cleanupRequest,
} = require('./requestStore');
const { buildSystemPrompt } = require('./buildSystemPrompt');

// ── Constants ─────────────────────────────────────────────────────────

/** ms — timeout applied when awaiting the initial connection / headers. */
const CONNECT_TIMEOUT_MS = 30_000;

/** ms — timeout for the full streaming response body. */
const STREAM_TIMEOUT_MS = 60_000;

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Merge the caller-provided AbortSignal with a timeout signal.
 *
 * Returns a merged AbortController (that aborts when either source aborts)
 * plus a cleanup function so callers can remove the timeout listener when
 * the request completes normally, avoiding leaked timers.
 *
 * If timeoutMs is 0 or negative, no timeout signal is created.
 *
 * @param {AbortSignal|null|undefined} externalSignal
 * @param {number} timeoutMs
 * @returns {{ mergedController: AbortController, cleanup: () => void }}
 */
function withTimeout(externalSignal, timeoutMs) {
  const merged = new AbortController();

  /** @type {NodeJS.Timeout|null} */
  let timer = null;

  const onExternalAbort = () => merged.abort(externalSignal.reason);
  const onMergedAbort = () => {
    if (timer) clearTimeout(timer);
  };

  if (externalSignal) {
    // If already aborted, propagate immediately.
    if (externalSignal.aborted) {
      merged.abort(externalSignal.reason);
      return { mergedController: merged, cleanup: () => {} };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      merged.abort(new DOMException('Request timed out', 'TimeoutError'));
    }, timeoutMs);
  }

  // When merged aborts (by anyone), clean up the timer and detach the
  // external listener so we don't leak.
  merged.signal.addEventListener('abort', () => {
    if (timer) clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }, { once: true });

  return {
    mergedController: merged,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

/**
 * Build the messages array sent to the LLM, prepending the system prompt.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [systemPromptOpts]
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages(messages, systemPromptOpts) {
  const systemContent = buildSystemPrompt(systemPromptOpts);
  return [
    { role: 'system', content: systemContent },
    ...messages,
  ];
}

/**
 * Map an HTTP status code to a ByokError factory method name.
 * @param {number} status
 * @returns {keyof typeof import('./errors').ByokError}
 */
function errorFactoryForStatus(status) {
  if (status === 401 || status === 403) return 'invalidKey';
  if (status === 404) return 'modelNotFound';
  if (status === 429) return 'rateLimited';
  return 'unknown';
}

/**
 * Parse a non-2xx HTTP response into a ByokError.
 *
 * @param {Response} response
 * @returns {Promise<ByokError>}
 */
async function httpErrorFromResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  const message =
    (body.error && body.error.message) ||
    body.message ||
    `HTTP ${response.status} ${response.statusText}`;

  const factory = errorFactoryForStatus(response.status);
  return ByokError[factory](message, { statusCode: response.status });
}

/**
 * Validate that the core callLLM/callLLMStream parameters are present.
 *
 * @param {object} params
 * @param {Array<{role: string, content: string}>} params.messages
 */
function validateParams(params) {
  if (!params || !params.messages || !Array.isArray(params.messages)) {
    throw ByokError.unknown(
      'callLLM requires a "messages" array with at least one message',
      { statusCode: null }
    );
  }
  if (params.messages.length === 0) {
    throw ByokError.unknown(
      'callLLM requires at least one message in the "messages" array',
      { statusCode: null }
    );
  }
}

// ── SSE chunk parser ──────────────────────────────────────────────────

/**
 * Parse SSE (Server-Sent Events) data chunks from the response body.
 *
 * Each chunk may contain multiple SSE lines.  Lines starting with "data: "
 * are collected; a bare "data: [DONE]" terminates the stream.
 *
 * @param {string} text  The raw text chunk from the ReadableStream
 * @returns {Array<object>} Parsed JSON delta objects
 */
function parseSSEChunk(text) {
  const results = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;

    const data = trimmed.slice(6); // strip "data: " prefix
    if (data === '[DONE]') {
      results.push({ done: true });
      continue;
    }

    try {
      const parsed = JSON.parse(data);
      results.push(parsed);
    } catch {
      // Malformed SSE lines are silently skipped (common with
      // providers that emit empty data lines or partial chunks).
    }
  }
  return results;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Call the configured LLM and return the full parsed response.
 *
 * @param {object} params
 * @param {Array<{role: string, content: string}>} params.messages
 *   The conversation messages (excluding the system prompt, which is
 *   prepended automatically).
 * @param {string} [params.requestId]
 *   Optional ID for request tracking via requestStore.
 * @param {AbortSignal} [params.signal]
 *   External AbortSignal for cancellation.
 * @param {object} [params.systemPromptOpts]
 *   Optional overrides passed to buildSystemPrompt (context, language).
 * @returns {Promise<object>} The parsed OpenAI chat completion response body.
 */
async function callLLM({ messages, requestId, signal, systemPromptOpts } = {}) {
  validateParams({ messages });

  // 1. Read config — throws if Electron app is unavailable.
  const config = await readConfig();

  if (!config.apiKey) {
    throw ByokError.invalidKey(
      'No API key configured. Please set your API key in the BYOK settings.'
    );
  }

  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const model = config.model || DEFAULT_MODEL;

  // 2. Register with request store if an ID was provided.
  let requestEntry = null;
  if (requestId) {
    requestEntry = createRequest(requestId);
  }

  // 3. Build merged abort signal (external + timeout).
  const { mergedController, cleanup } = withTimeout(signal, CONNECT_TIMEOUT_MS);

  // If requestStore tracking is active, wire up its AbortController too.
  if (requestEntry) {
    requestEntry.abortController.signal.addEventListener('abort', () => {
      mergedController.abort(requestEntry.abortController.signal.reason);
    }, { once: true });
  }

  try {
    // 4. Build request body.
    const allMessages = buildMessages(messages, systemPromptOpts);
    const body = {
      model,
      messages: allMessages,
      stream: false,
    };

    // 5. Call fetch.
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: mergedController.signal,
    });

    // 6. Handle non-2xx.
    if (!response.ok) {
      const err = await httpErrorFromResponse(response);
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = err;
      }
      throw err;
    }

    // 7. Parse and return.
    const result = await response.json();

    if (requestEntry) {
      requestEntry.status = 'completed';
    }

    return result;
  } catch (err) {
    // Don't wrap our own errors.
    if (err instanceof ByokError) throw err;

    // Classify the error.
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const byokErr = ByokError.endpointUnreachable(
        'Request timed out or was cancelled',
        { cause: err }
      );
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = byokErr;
      }
      throw byokErr;
    }

    // Network-level failure (DNS, connection refused, etc.) — fetch throws TypeError.
    if (err instanceof TypeError) {
      const byokErr = ByokError.endpointUnreachable(
        `Could not reach ${endpoint}: ${err.message}`,
        { cause: err }
      );
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = byokErr;
      }
      throw byokErr;
    }

    // Unknown errors.
    const byokErr = ByokError.unknown(err.message, { cause: err });
    if (requestEntry) {
      requestEntry.status = 'errored';
      requestEntry.error = byokErr;
    }
    throw byokErr;
  } finally {
    cleanup();
    // Keep the entry in the store for status queries; caller should
    // call cleanupRequest when done.
  }
}

/**
 * Call the configured LLM with streaming response, calling onChunk for
 * each delta received.
 *
 * @param {object} params
 * @param {Array<{role: string, content: string}>} params.messages
 *   The conversation messages (excluding the system prompt).
 * @param {function(object): void} params.onChunk
 *   Called for each parsed SSE delta. Receives the parsed JSON object
 *   from the SSE "data:" line (choices[0].delta).
 * @param {string} [params.requestId]
 *   Optional ID for request tracking.
 * @param {AbortSignal} [params.signal]
 *   External AbortSignal for cancellation.
 * @param {object} [params.systemPromptOpts]
 *   Optional overrides passed to buildSystemPrompt.
 * @returns {Promise<string>} The accumulated full response text.
 */
async function callLLMStream({
  messages,
  onChunk,
  requestId,
  signal,
  systemPromptOpts,
} = {}) {
  validateParams({ messages });

  if (typeof onChunk !== 'function') {
    throw ByokError.unknown(
      'callLLMStream requires an "onChunk" callback function',
      { statusCode: null }
    );
  }

  // 1. Read config.
  const config = await readConfig();

  if (!config.apiKey) {
    throw ByokError.invalidKey(
      'No API key configured. Please set your API key in the BYOK settings.'
    );
  }

  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const model = config.model || DEFAULT_MODEL;

  // 2. Register with request store.
  let requestEntry = null;
  if (requestId) {
    requestEntry = createRequest(requestId);
    requestEntry.status = 'streaming';
  }

  // 3. Build merged abort signal.
  const { mergedController, cleanup } = withTimeout(signal, STREAM_TIMEOUT_MS);

  if (requestEntry) {
    requestEntry.abortController.signal.addEventListener('abort', () => {
      mergedController.abort(requestEntry.abortController.signal.reason);
    }, { once: true });
  }

  try {
    const allMessages = buildMessages(messages, systemPromptOpts);
    const body = {
      model,
      messages: allMessages,
      stream: true,
      // Request stream_options so providers that support it include usage
      // stats in the final chunk.
      stream_options: { include_usage: true },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: mergedController.signal,
    });

    if (!response.ok) {
      const err = await httpErrorFromResponse(response);
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = err;
      }
      throw err;
    }

    // 4. Read the stream.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    let done = false;
    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;

      const text = decoder.decode(value, { stream: true });
      const chunks = parseSSEChunk(text);

      for (const chunk of chunks) {
        if (chunk.done) {
          done = true;
          break;
        }

        // Extract the delta content.
        const delta =
          chunk.choices &&
          chunk.choices[0] &&
          chunk.choices[0].delta;

        if (delta && delta.content) {
          accumulated += delta.content;
        }

        // Always call onChunk with the parsed chunk so callers can
        // inspect usage, finish_reason, etc.
        onChunk(chunk);
      }
    }

    if (requestEntry) {
      requestEntry.status = 'completed';
    }

    return accumulated;
  } catch (err) {
    if (err instanceof ByokError) throw err;

    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const byokErr = ByokError.endpointUnreachable(
        'Stream request timed out or was cancelled',
        { cause: err }
      );
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = byokErr;
      }
      throw byokErr;
    }

    if (err instanceof TypeError) {
      const byokErr = ByokError.endpointUnreachable(
        `Could not reach ${endpoint}: ${err.message}`,
        { cause: err }
      );
      if (requestEntry) {
        requestEntry.status = 'errored';
        requestEntry.error = byokErr;
      }
      throw byokErr;
    }

    const byokErr = ByokError.unknown(err.message, { cause: err });
    if (requestEntry) {
      requestEntry.status = 'errored';
      requestEntry.error = byokErr;
    }
    throw byokErr;
  } finally {
    cleanup();
  }
}

module.exports = { callLLM, callLLMStream };
