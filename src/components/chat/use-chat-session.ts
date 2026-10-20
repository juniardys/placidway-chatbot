"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SESSION_STORAGE_KEY = "placidway.chatSessionId";

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  citations: { title: string; url: string }[];
};

function readStoredId() {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* storage unavailable: session lasts for this page only */
  }
}

/**
 * Keeps the chat tied to a server-side session whose id lives in
 * localStorage, so a reload restores the conversation. `reset` only forgets
 * the id locally; the old session and its messages stay in the database.
 */
export function useChatSession(onRestore: (messages: StoredMessage[]) => void) {
  const [restoring, setRestoring] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    const id = readStoredId();
    if (!id) {
      setRestoring(false);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/chat/sessions/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404 || response.status === 400) {
          writeStoredId(null);
          return;
        }
        if (!response.ok) return;
        const data = (await response.json()) as { messages?: StoredMessage[] };
        sessionIdRef.current = id;
        onRestoreRef.current(data.messages ?? []);
      })
      .catch(() => {
        /* keep the stored id; a later reload can retry */
      })
      .finally(() => {
        if (!controller.signal.aborted) setRestoring(false);
      });
    return () => controller.abort();
  }, []);

  const ensureSessionId = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;
    const stored = readStoredId();
    if (stored) {
      sessionIdRef.current = stored;
      return stored;
    }
    const response = await fetch("/api/chat/sessions", { method: "POST" });
    if (!response.ok) throw new Error("Unable to start session");
    const { id } = (await response.json()) as { id: string };
    sessionIdRef.current = id;
    writeStoredId(id);
    return id;
  }, []);

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    writeStoredId(null);
  }, []);

  return { restoring, ensureSessionId, reset };
}
