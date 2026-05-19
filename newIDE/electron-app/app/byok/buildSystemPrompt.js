'use strict';

/**
 * Default system prompt used when no custom context is supplied.
 * Describes the assistant's role in the GDevelop game-development IDE.
 */
const DEFAULT_SYSTEM_PROMPT = [
  'You are an AI assistant integrated into GDevelop, an open-source',
  '2D game development IDE. Your role is to help users create games,',
  'write event-sheet logic, and debug issues within the GDevelop engine.',
  '',
  'Guidelines:',
  '- Answer concisely and prefer actionable guidance.',
  '- When providing code or expressions, format them for GDevelop\'s',
  '  event-sheet system or JavaScript code blocks where applicable.',
  '- If you are unsure about a GDevelop-specific API, acknowledge it',
  '  rather than guessing.',
].join('\n');

/**
 * Assemble a system prompt from optional context and language settings.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.context]  User-supplied context to inject into the prompt.
 * @param {string}  [opts.language] Preferred language for the assistant (e.g. "en", "fr").
 * @returns {string} The fully assembled system prompt string.
 */
function buildSystemPrompt({ context, language } = {}) {
  const parts = [];

  // Base role description
  parts.push(DEFAULT_SYSTEM_PROMPT);

  // Inject user-provided context when available
  if (context && typeof context === 'string' && context.trim().length > 0) {
    parts.push('');
    parts.push('Additional context from the user:');
    parts.push(context.trim());
  }

  // Language preference
  if (language && typeof language === 'string' && language.trim().length > 0) {
    parts.push('');
    parts.push(`Respond in ${language.trim()} language.`);
  }

  return parts.join('\n');
}

module.exports = { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT };
