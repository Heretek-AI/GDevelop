'use strict';

/**
 * BYOK configuration persistence layer.
 *
 * Reads and writes a JSON config file at app.getPath('userData')/byok-config.json
 * using fs-extra (already a dependency of the electron-app package).
 *
 * This module requires Electron's `app` module and therefore can only run inside
 * an Electron main process — it cannot be unit-tested with plain Node.
 */

const fs = require('fs-extra');
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
    const raw = await fs.readFile(configPath, 'utf8');
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
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

module.exports = { readConfig, writeConfig, getConfigPath, DEFAULT_CONFIG };
