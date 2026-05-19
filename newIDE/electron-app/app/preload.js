'use strict';

/**
 * BYOK preload script — bridges renderer ↔ main process for AI features.
 *
 * Exposes window.byokAi via contextBridge with methods that map to IPC handlers
 * in byokMain.js.  The renderer never gets direct access to ipcRenderer or Node
 * APIs — all communication goes through these typed channels.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('byokAi', {
  /**
   * Read the current BYOK configuration (API key is masked for safety).
   * @returns {Promise<object>}
   */
  getConfig: () => ipcRenderer.invoke('byok:getConfig'),

  /**
   * Save BYOK configuration to disk.
   * @param {object} config
   * @returns {Promise<{ok: true}>}
   */
  saveConfig: (config) => ipcRenderer.invoke('byok:saveConfig', config),

  /**
   * Send a non-streaming LLM completion request.
   * @param {{messages: Array, model?: string, temperature?: number, maxTokens?: number}} opts
   * @returns {Promise<{text: string}>}
   */
  callLLM: (opts) => ipcRenderer.invoke('byok:callLLM', opts),

  /**
   * Send a streaming LLM completion request.
   *
   * Chunks arrive as SSE deltas via the 'byok:stream-chunk' event.
   * Completion is signaled by 'byok:stream-done'.
   * Errors arrive via 'byok:stream-error'.
   *
   * @param {object} opts                    — options passed to callLLMStream
   * @param {(chunk: object) => void} onChunk — called for each SSE delta chunk
   * @param {(result: {text: string}) => void} onDone — called on successful completion
   * @param {(error: ByokErrorJSON) => void} onError — called on error
   * @returns {() => void} cleanup function — call to remove listeners
   */
  callLLMStream: (opts, onChunk, onDone, onError) => {
    const chunkHandler = (_event, chunk) => {
      if (typeof onChunk === 'function') onChunk(chunk);
    };
    const doneHandler = (_event, result) => {
      cleanup();
      if (typeof onDone === 'function') onDone(result);
    };
    const errorHandler = (_event, error) => {
      cleanup();
      if (typeof onError === 'function') onError(error);
    };

    ipcRenderer.on('byok:stream-chunk', chunkHandler);
    ipcRenderer.on('byok:stream-done', doneHandler);
    ipcRenderer.on('byok:stream-error', errorHandler);

    ipcRenderer.send('byok:callLLMStream', opts);

    function cleanup() {
      ipcRenderer.removeListener('byok:stream-chunk', chunkHandler);
      ipcRenderer.removeListener('byok:stream-done', doneHandler);
      ipcRenderer.removeListener('byok:stream-error', errorHandler);
    }

    return cleanup;
  },

  /**
   * Get a snapshot of active (in-flight or streaming) AI requests.
   * @returns {Promise<Array<{id: string, status: string, startTime: number}>>}
   */
  getActiveRequests: () => ipcRenderer.invoke('byok:getActiveRequests'),

  /**
   * Abort an active AI request by its ID.
   * @param {string} requestId
   * @returns {Promise<{aborted: boolean}>}
   */
  abortRequest: (requestId) =>
    ipcRenderer.invoke('byok:abortRequest', requestId),
});
