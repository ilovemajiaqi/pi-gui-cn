/**
 * Sent composer lines per session, oldest first, backing the composer's ArrowUp
 * recall. Both send paths record here: the composer's own submit and the slash
 * menu's immediate runtime commands. Renderer-local on purpose — recall history
 * never outlives the window, and the persisted drafts remain the single durable
 * surface.
 */
const historyBySession = new Map<string, string[]>();

const PROMPT_HISTORY_LIMIT = 50;

export function recordSentPrompt(sessionId: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  const entries = historyBySession.get(sessionId) ?? [];
  if (entries[entries.length - 1] === trimmed) {
    return;
  }
  const next = [...entries, trimmed];
  if (next.length > PROMPT_HISTORY_LIMIT) {
    next.splice(0, next.length - PROMPT_HISTORY_LIMIT);
  }
  historyBySession.set(sessionId, next);
}

/** Drops the newest entry when a failed send hands the prompt back to the composer. */
export function forgetSentPrompt(sessionId: string, text: string): void {
  const trimmed = text.trim();
  const entries = historyBySession.get(sessionId);
  if (!entries || entries[entries.length - 1] !== trimmed) {
    return;
  }
  entries.pop();
}

export function sentPromptsForSession(sessionId: string): readonly string[] {
  return historyBySession.get(sessionId) ?? [];
}
