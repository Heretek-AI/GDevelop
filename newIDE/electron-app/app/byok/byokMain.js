'use strict';

/**
 * Centralized BYOK IPC handler registration module.
 *
 * Imports all 5 BYOK proxy modules and registers IPC handlers with the
 * Electron ipcMain instance. Called once from main.js inside app.on('ready').
 *
 * IPC Channels:
 *   byok:getConfig         — handle, returns readConfig() result
 *   byok:saveConfig        — handle, accepts config object, calls writeConfig()
 *   byok:callLLM           — handle, accepts callLLM() opts, returns response text
 *   byok:callLLMStream     — on, accepts callLLMStream() opts, sends chunks back
 *   byok:getActiveRequests — handle, returns getActiveRequests() snapshot
 *   byok:abortRequest      — handle, accepts requestId, calls abortRequest()
 */

const { ByokError, ByokErrorCodes } = require('./errors');
const { readConfig, writeConfig } = require('./byokConfig');
const { callLLM, callLLMStream } = require('./callLLM');
const { getActiveRequests, abortRequest } = require('./requestStore');

/**
 * Register all BYOK IPC handlers on the given ipcMain instance.
 *
 * @param {Electron.IpcMain} ipcMain
 */
function registerByokHandlers(ipcMain) {
  // ── Configuration ─────────────────────────────────────────────────

  ipcMain.handle('byok:getConfig', async () => {
    try {
      const config = await readConfig();
      // Never send the raw API key to the renderer; send a masked version.
      const safeConfig = { ...config };
      if (safeConfig.apiKey && safeConfig.apiKey.length > 8) {
        safeConfig.apiKey =
          safeConfig.apiKey.slice(0, 4) + '••••' + safeConfig.apiKey.slice(-4);
      }
      safeConfig.hasApiKey = !!config.apiKey;
      return safeConfig;
    } catch (err) {
      throw ByokError.unknown('Failed to read BYOK config', { cause: err }).toJSON();
    }
  });

  ipcMain.handle('byok:saveConfig', async (_event, config) => {
    try {
      if (!config || typeof config !== 'object') {
        throw ByokError.unknown('Invalid config object');
      }

      // Merge apiKey: the renderer receives a masked key from byok:getConfig.
      // If the user saves without changing the API key field (empty/masked),
      // we must preserve the real key from the existing on-disk config.
      // If incoming.apiKey is a non-empty string (user typed a new key),
      // it replaces the existing key.
      const existing = await readConfig();
      if (existing.apiKey && (!config.apiKey || config.apiKey === '')) {
        config.apiKey = existing.apiKey;
        console.info('[byok:saveConfig] apiKey preserved from existing config (incoming key was empty/masked)');
      } else if (config.apiKey && config.apiKey !== existing.apiKey) {
        console.info('[byok:saveConfig] apiKey replaced with new incoming value');
      }

      await writeConfig(config);
      return { ok: true };
    } catch (err) {
      if (err instanceof ByokError) throw err.toJSON();
      throw ByokError.unknown('Failed to save BYOK config', { cause: err }).toJSON();
    }
  });

  // ── Non-streaming LLM call ───────────────────────────────────────

  ipcMain.handle('byok:callLLM', async (_event, opts) => {
    try {
      if (!opts || !opts.messages || !Array.isArray(opts.messages)) {
        throw ByokError.unknown('callLLM requires a messages array');
      }
      const result = await callLLM(opts);
      return { text: result };
    } catch (err) {
      if (err instanceof ByokError) throw err.toJSON();
      throw ByokError.unknown(err.message, { cause: err }).toJSON();
    }
  });

  // ── Streaming LLM call ───────────────────────────────────────────

  ipcMain.on('byok:callLLMStream', async (event, opts) => {
    try {
      if (!opts || !opts.messages || !Array.isArray(opts.messages)) {
        event.sender.send(
          'byok:stream-error',
          ByokError.unknown('callLLMStream requires a messages array').toJSON()
        );
        return;
      }

      const streamOpts = {
        ...opts,
        onChunk: (chunk) => {
          // Forward each SSE chunk to the renderer as a structured event.
          event.sender.send('byok:stream-chunk', chunk);
        },
      };

      const result = await callLLMStream(streamOpts);
      event.sender.send('byok:stream-done', { text: result });
    } catch (err) {
      const errorPayload =
        err instanceof ByokError
          ? err.toJSON()
          : ByokError.unknown(err.message, { cause: err }).toJSON();
      event.sender.send('byok:stream-error', errorPayload);
    }
  });

  // ── Request tracking ─────────────────────────────────────────────

  ipcMain.handle('byok:getActiveRequests', async () => {
    return getActiveRequests();
  });

  ipcMain.handle('byok:abortRequest', async (_event, requestId) => {
    if (typeof requestId !== 'string') {
      throw ByokError.unknown('abortRequest requires a string requestId').toJSON();
    }
    const result = abortRequest(requestId);
    return { aborted: result };
  });
}

module.exports = { registerByokHandlers };
