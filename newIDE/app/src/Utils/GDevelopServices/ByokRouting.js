// @flow
import type {
  AiRequest,
  AiRequestMessage,
  AiRequestUserMessage,
  AiRequestAssistantMessage,
} from './Generation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a local UUID.
 *
 * Prefers crypto.randomUUID() when available; falls back to a
 * Date.now() + Math.random() concatenation for environments where
 * crypto.randomUUID is unavailable (older browsers, insecure contexts).
 */
const generateUUID = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random components, formatted as a v4-style UUID.
  const timestamp = Date.now().toString(36);
  const random = Math.random()
    .toString(36)
    .substring(2, 10);
  const suffix = Math.random()
    .toString(36)
    .substring(2, 14);
  return `${timestamp}-${random}-4${suffix.substring(1, 4)}-${suffix.substring(
    4,
    8
  )}-${suffix.substring(8, 12)}`;
};

/**
 * Build an AiRequest-compatible user message from raw text.
 */
const buildUserMessage = (
  text: string,
  messageId?: string
): AiRequestUserMessage => ({
  type: 'message',
  status: 'completed',
  role: 'user',
  content: [
    {
      type: 'user_request',
      status: 'completed',
      text,
    },
  ],
  messageId,
});

/**
 * Build an AiRequest-compatible assistant message from LLM output text.
 */
const buildAssistantMessage = (
  text: string,
  messageId?: string
): AiRequestAssistantMessage => ({
  type: 'message',
  status: 'completed',
  role: 'assistant',
  content: [
    {
      type: 'output_text',
      status: 'completed',
      text,
      annotations: [],
    },
  ],
  messageId,
});

/**
 * Convert an AiRequestMessage array to the {role, content} format that
 * the LLM IPC interface expects.
 *
 * Only message-type entries with completed status are included;
 * function_call and function_call_output entries are skipped because
 * the BYOK LLM does not (yet) execute tool calls.
 */
const toLLMConversation = (
  messages: Array<AiRequestMessage>
): Array<{ role: string, content: string }> => {
  const conversation: Array<{ role: string, content: string }> = [];
  for (const msg of messages) {
    if (msg.type !== 'message') continue;

    if (msg.role === 'user') {
      const userMsg: AiRequestUserMessage = (msg: any);
      const textContent = userMsg.content.find(c => c.type === 'user_request');
      if (textContent && textContent.text) {
        conversation.push({ role: 'user', content: textContent.text });
      }
    } else if (msg.role === 'assistant') {
      const asstMsg: AiRequestAssistantMessage = (msg: any);
      // Concatenate all output_text entries (skipping reasoning and function_calls).
      const parts: Array<string> = [];
      for (const block of asstMsg.content) {
        if (block.type === 'output_text' && block.text) {
          parts.push(block.text);
        }
      }
      if (parts.length > 0) {
        conversation.push({ role: 'assistant', content: parts.join('\n') });
      }
    }
  }
  return conversation;
};

// ---------------------------------------------------------------------------
// BYOK-compatible AiRequest creators
// ---------------------------------------------------------------------------

/**
 * Create a new AiRequest through the BYOK (Bring Your Own Key) IPC channel.
 *
 * Instead of hitting the GDevelop Generation REST API, this builds a local
 * AiRequest-shaped object whose assistant response comes from the user's own
 * LLM provider via `window.byokAi.callLLM`.
 *
 * @param userRequest — the user's natural-language prompt
 * @param mode        — the AI mode (chat / agent / orchestrator)
 * @returns a Promise that always resolves to an AiRequest-compatible shape
 *          (errors are captured in `.error`, not thrown).
 */
export const byokCreateAiRequest = async ({
  userRequest,
  mode,
}: {|
  userRequest: string,
  mode: 'chat' | 'agent' | 'orchestrator',
|}): Promise<$Shape<AiRequest>> => {
  console.info('[ByokRouting] Creating BYOK AI request', {
    mode,
    userRequestLength: userRequest.length,
  });

  const requestId = generateUUID();
  const now = new Date().toISOString();

  const userMessage = buildUserMessage(userRequest);

  try {
    const result = await window.byokAi.callLLM({
      messages: [{ role: 'user', content: userRequest }],
    });

    const assistantMessage = buildAssistantMessage(result.text);

    console.info('[ByokRouting] BYOK request completed successfully', {
      requestId,
      mode,
    });

    return {
      id: requestId,
      createdAt: now,
      updatedAt: new Date().toISOString(),
      userId: '',
      gameId: null,
      gameProjectJson: null,
      status: 'ready',
      mode,
      aiConfiguration: { presetId: 'byok' },
      toolsVersion: null,
      toolOptions: null,
      forkedFromAiRequestId: null,
      forkedAfterOriginalMessageId: null,
      forkedAfterNewMessageId: null,
      error: null,
      output: [userMessage, assistantMessage],
      lastUserMessagePriceInCredits: null,
      totalPriceInCredits: null,
    };
  } catch (err) {
    const errorMessage =
      err && typeof err === 'object' && err.message
        ? err.message
        : 'Unknown BYOK error';
    console.info('[ByokRouting] BYOK request failed', {
      requestId,
      mode,
      error: errorMessage,
    });

    return {
      id: requestId,
      createdAt: now,
      updatedAt: new Date().toISOString(),
      userId: '',
      gameId: null,
      gameProjectJson: null,
      status: 'error',
      mode,
      aiConfiguration: { presetId: 'byok' },
      toolsVersion: null,
      toolOptions: null,
      forkedFromAiRequestId: null,
      forkedAfterOriginalMessageId: null,
      forkedAfterNewMessageId: null,
      error: {
        code: 'byok:callLLM',
        message: errorMessage,
      },
      output: [userMessage],
      lastUserMessagePriceInCredits: null,
      totalPriceInCredits: null,
    };
  }
};

/**
 * Append a user message to an existing AiRequest through the BYOK IPC channel.
 *
 * Extracts the existing conversation from `aiRequest.output`, appends the new
 * user message, calls the LLM with the full conversation, and pushes both the
 * new user message and the assistant response onto `aiRequest.output`.
 *
 * @param aiRequest   — the existing AiRequest to extend
 * @param userMessage — the new user text to append
 * @returns a Promise that always resolves to an updated AiRequest-compatible
 *          shape (errors are captured in `.error`, not thrown).
 */
export const byokAddMessageToAiRequest = async (
  aiRequest: $Shape<AiRequest>,
  userMessage: string
): Promise<$Shape<AiRequest>> => {
  console.info('[ByokRouting] Adding message to BYOK AI request', {
    requestId: aiRequest.id,
    userMessageLength: userMessage.length,
  });

  const newUserMsg = buildUserMessage(userMessage);

  // Build the LLM conversation from the AiRequest's existing output,
  // then append the new user message at the end.
  const existingMessages: Array<AiRequestMessage> = aiRequest.output || [];
  const conversation = toLLMConversation(existingMessages);
  conversation.push({ role: 'user', content: userMessage });

  try {
    const result = await window.byokAi.callLLM({ messages: conversation });
    const assistantMsg = buildAssistantMessage(result.text);

    const updatedOutput = [...existingMessages, newUserMsg, assistantMsg];

    console.info('[ByokRouting] BYOK message added successfully', {
      requestId: aiRequest.id,
      totalMessages: updatedOutput.length,
    });

    return {
      ...aiRequest,
      updatedAt: new Date().toISOString(),
      status: 'ready',
      output: updatedOutput,
      error: null,
    };
  } catch (err) {
    const errorMessage =
      err && typeof err === 'object' && err.message
        ? err.message
        : 'Unknown BYOK error';
    console.info('[ByokRouting] BYOK add message failed', {
      requestId: aiRequest.id,
      error: errorMessage,
    });

    return {
      ...aiRequest,
      updatedAt: new Date().toISOString(),
      status: 'error',
      output: [...existingMessages, newUserMsg],
      error: {
        code: 'byok:callLLM',
        message: errorMessage,
      },
    };
  }
};

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/**
 * Returns true when the given preset ID is the BYOK preset.
 */
export const isByokPreset = (presetId: string): boolean => {
  return presetId === 'byok';
};

/**
 * Returns true when the BYOK IPC bridge is available in the current context
 * (i.e. we are running inside the Electron renderer with the preload script).
 */
export const isByokAiAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.byokAi;
};
