"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ActivityStep, AgentActivity } from "./agent-activity";
import { RichText } from "./rich-text";
import { useChatSession } from "./use-chat-session";
import "./chat-session.css";

type Citation = { title: string; url: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  activity?: ActivityStep[];
  durationMs?: number;
};

const REQUEST_TIMEOUT_MS = 90_000;

const suggestions = [
  "What treatments are available in Tijuana?",
  "How much does the adenocarcinoma package cost?",
  "What is included in the clinic package?",
];

export function ChatShell() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Message | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const conversationRef = useRef<HTMLElement>(null);
  const session = useChatSession((stored) =>
    setMessages(
      stored.map((message) => ({
        role: message.role,
        text: message.content,
        citations: message.citations,
      })),
    ),
  );

  function resetChat() {
    if (loading) return;
    session.reset();
    setMessages([]);
    setQuestion("");
    setError("");
    setLastQuestion("");
  }

  useEffect(() => {
    const node = conversationRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function submit(value = question) {
    const text = value.trim();
    if (!text || loading || session.restoring) return;
    const history = messages.map(({ role, text: content }) => ({ role, content }));
    setQuestion("");
    setError("");
    setLastQuestion(text);
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    let answer = "";
    let citations: Citation[] = [];
    let activity: ActivityStep[] = [];
    const startedAt = performance.now();
    const settle = () => activity.map((step) => ({ ...step, status: "done" as const }));
    const publish = () => setPending({ role: "assistant", text: answer, citations, activity });
    publish();
    try {
      // Chat still works if the session cannot be created; it just won't persist.
      const sessionId = await session.ensureSessionId().catch(() => undefined);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, history, sessionId }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok || !response.body) throw new Error("Request failed");
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += chunk;
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((entry) => entry.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "thinking")
            activity = [...settle(), { kind: "thinking", label: event.message, status: "done" }];
          if (event.type === "tool_start")
            activity = [...settle(), { kind: "search", label: "Searching PlacidWay knowledge", detail: event.query, status: "running" }];
          if (event.type === "tool_result")
            activity = [
              ...settle(),
              {
                kind: "sources",
                label: `Found ${event.sources} source${event.sources === 1 ? "" : "s"}`,
                detail: `${event.chunks} relevant passage${event.chunks === 1 ? "" : "s"}`,
                status: "done",
              },
            ];
          if (event.type === "answer_start")
            activity = [...settle(), { kind: "compose", label: "Writing a grounded answer", status: "running" }];
          if (event.type === "delta") answer += event.text;
          if (event.type === "citation" && !citations.some((item) => item.url === event.citation.url))
            citations = [...citations, { title: event.citation.title, url: event.citation.url }];
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") finished = true;
          publish();
        }
      }
      if (!answer) throw new Error("Empty answer");
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer, citations, activity: settle(), durationMs: performance.now() - startedAt },
      ]);
    } catch {
      // Drop the unanswered question so Retry does not duplicate it in history.
      setMessages((current) => current.slice(0, -1));
      setError("Couldn’t reach the knowledge assistant. Try again.");
    } finally {
      setPending(null);
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <main className="chat-page">
      <div className="chat-frame">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true">
            <span>+</span>
          </div>
          <div>
            <p className="brand-name">PlacidWay</p>
            <p className="brand-subtitle">Care, made clearer</p>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              className="reset-chat"
              onClick={resetChat}
              disabled={loading}
            >
              New chat
            </button>
          ) : null}
        </header>

        <section
          className="conversation"
          aria-live="polite"
          aria-label="Conversation"
          ref={conversationRef}
        >
          {messages.length === 0 ? (
            <div className="empty-state">
              <span className="spark">✦</span>
              <p className="empty-title">Where would you like to begin?</p>
              <p className="empty-caption">
                Choose a question or write your own below.
              </p>
              <div className="suggestions">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void submit(suggestion)}
                  >
                    {suggestion}
                    <span>↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message, index) =>
                message.role === "user" ? (
                  <article className="message user" key={`user-${index}`}>
                    <p>{message.text}</p>
                  </article>
                ) : (
                  <AssistantMessage key={`assistant-${index}`} message={message} />
                ),
              )}
              {loading && pending ? <AssistantMessage message={pending} live /> : null}
            </div>
          )}
        </section>

        <form className="composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="question">
            Ask about treatment, packages, clinics, or prices
          </label>
          <input
            id="question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about treatments, packages, clinics, or prices…"
            disabled={loading || session.restoring}
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={loading || session.restoring || !question.trim()}
          >
            <span>Ask</span>
            <b>↑</b>
          </button>
        </form>
        {error ? (
          <div className="error-message" role="alert">
            {error} <button onClick={() => void submit(lastQuestion)}>Retry</button>
          </div>
        ) : (
          <p className="disclaimer">
            For information only. Always consult a qualified medical
            professional for personal advice.
          </p>
        )}
      </div>
    </main>
  );
}

function AssistantMessage({ message, live = false }: { message: Message; live?: boolean }) {
  const citations = message.citations ?? [];
  return (
    <article className={`message assistant ${live ? "is-live" : ""}`}>
      <div className="assistant-avatar" aria-hidden="true">
        <span>+</span>
      </div>
      <div className="assistant-body">
        <div className="message-label">PlacidWay assistant</div>
        <AgentActivity
          steps={message.activity ?? []}
          live={live && !message.text}
          durationMs={message.durationMs}
          sourceCount={citations.length}
        />
        {message.text ? (
          <RichText text={message.text} streaming={live} />
        ) : !message.activity?.length ? (
          <div className="typing">
            <i />
            <i />
            <i />
          </div>
        ) : null}
        {citations.length && !live ? (
          <div className="sources">
            <span className="sources-label">Sources</span>
            <div className="source-grid">
              {citations.map((citation, index) => (
                <a className="source-card" key={citation.url} href={citation.url} target="_blank" rel="noreferrer">
                  <span className="source-index">{index + 1}</span>
                  <span className="source-copy">
                    <span className="source-title">{citation.title}</span>
                    <span className="source-host">{hostOf(citation.url)}</span>
                  </span>
                  <span className="source-arrow" aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
