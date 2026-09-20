import type { CrosswordSession } from "./crosswordTypes";

export const CROSSWORD_STORAGE_PREFIX = "scratchoff-lite:crossword";

export function getCrosswordStorageKey(userId: string) {
  return `${CROSSWORD_STORAGE_PREFIX}:${userId}`;
}

export function serializeCrosswordSession(session: CrosswordSession) {
  return JSON.stringify(session);
}

export function deserializeCrosswordSession(raw: string | null): CrosswordSession | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CrosswordSession;
    if (!parsed || parsed.version !== 1 || parsed.ticket?.gameType !== "crossword" || parsed.state?.version !== 1) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
