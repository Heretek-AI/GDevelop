'use strict';

/**
 * Typed error codes for BYOK (Bring Your Own Key) LLM integration.
 * Each code maps to a specific failure category used across the IPC bridge
 * so the renderer can react with appropriate user-facing messaging.
 */
const ByokErrorCodes = Object.freeze({
  /** The provided API key is invalid or has been revoked by the provider. */
  INVALID_KEY: 'INVALID_KEY',
  /** The configured endpoint could not be reached (DNS, connection refused, timeout). */
  ENDPOINT_UNREACHABLE: 'ENDPOINT_UNREACHABLE',
  /** The requested model identifier is not available at the configured endpoint. */
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  /** The provider returned a 429 status — rate limit exceeded. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** An unexpected or unknown error that does not fit any other category. */
  UNKNOWN: 'UNKNOWN',
});

/**
 * Structured error for BYOK operations.
 *
 * Extends Error so it interoperates with logging and error-reporting tooling.
 * Includes a typed {@link code}, the upstream HTTP status when available,
 * and a toJSON() method so it survives Electron IPC serialization without
 * losing type information.
 */
class ByokError extends Error {
  /**
   * @param {string} code    One of {@link ByokErrorCodes}
   * @param {string} message Human-readable description
   * @param {object} [opts]
   * @param {number} [opts.statusCode]  HTTP status from the upstream response
   * @param {*}      [opts.cause]       Underlying error for chaining
   */
  constructor(code, message, { statusCode, cause } = {}) {
    super(message);
    this.name = 'ByokError';
    this.code = code;
    this.statusCode = statusCode !== undefined ? statusCode : null;
    if (cause !== undefined) this.cause = cause;
  }

  // ── Static factory methods ──────────────────────────────────────────

  static invalidKey(message, opts) {
    return new ByokError(ByokErrorCodes.INVALID_KEY, message, opts);
  }

  static endpointUnreachable(message, opts) {
    return new ByokError(ByokErrorCodes.ENDPOINT_UNREACHABLE, message, opts);
  }

  static modelNotFound(message, opts) {
    return new ByokError(ByokErrorCodes.MODEL_NOT_FOUND, message, opts);
  }

  static rateLimited(message, opts) {
    return new ByokError(ByokErrorCodes.RATE_LIMITED, message, opts);
  }

  static unknown(message, opts) {
    return new ByokError(ByokErrorCodes.UNKNOWN, message, opts);
  }

  // ── IPC serialization ───────────────────────────────────────────────

  /**
   * Returns a plain object suitable for Electron IPC (structured clone).
   * Without this, Error instances lose their custom properties when sent
   * through contextBridge / ipcRenderer.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

ByokError.codes = ByokErrorCodes;

module.exports = { ByokError, ByokErrorCodes };
