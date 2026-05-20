'use strict';

/**
 * BYOK configuration persistence layer.
 *
 * Reads and writes a JSON config file at app.getPath('userData')/byok-config.json.
 *
 * Uses native Node.js `fs` module (no external dependency) so the module can
 * be loaded in any Node.js environment, including CI.  The Electron `app`
 * dependency remains for runtime path resolution inside the Electron main
 * process — unit tests mock it via Module._resolveFilename.
 */

const fs = require('fs');
const fsp = require('fs').promises;
const { app } = require('electron');
const path = require('path');

/**
 * Default configuration returned when no config file exists on disk.
 */
const DEFAULT_CONFIG = Object.freeze({
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
});

/**
 * Returns the absolute path to the BYOK config JSON file.
 * @returns {string}
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'byok-config.json');
}

/**
 * Reads the persisted BYOK configuration file.
 *
 * Returns a shallow-merged object of DEFAULT_CONFIG + persisted values so
 * callers always see every key even when the on-disk file is partial.
 *
 * @returns {Promise<object>} Configuration object
 */
async function readConfig() {
  const configPath = getConfigPath();

  let persisted;
  try {
    const raw = await fsp.readFile(configPath, 'utf8');
    persisted = JSON.parse(raw);
  } catch (err) {
    // ENOENT is expected on first launch — return defaults.
    // Other errors (permission denied, corrupt JSON) also fall back to
    // defaults so the app remains usable; the write path will surface the
    // issue when the user tries to save.
    if (err.code !== 'ENOENT') {
      console.warn('[byokConfig] Could not read config, using defaults:', err.message);
    }
    persisted = {};
  }

  return { ...DEFAULT_CONFIG, ...persisted };
}

/**
 * Persists the BYOK configuration to disk as JSON with 2-space indentation.
 *
 * @param {object} config  Configuration object to write.
 * @returns {Promise<void>}
 */
async function writeConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('config must be a non-null object');
  }
  const configPath = getConfigPath();
  await fsp.mkdir(path.dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { readConfig, writeConfig, getConfigPath, DEFAULT_CONFIG };
