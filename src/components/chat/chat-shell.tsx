"use client";

import { FormEvent, useState } from "react";

type Citation = { title: string; url: string };
type Message = {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
};

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

  async function submit(value = question) {
    const text = value.trim();
    if (!text || loading) return;
    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text }]);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          history: messages.map(({ role, text: content }) => ({
            role,
            content,
          })),
        }),
      });
      if (!response.ok) throw new Error("Request failed");
      const raw = await response.text();
      let answer = "";
      let citations: Citation[] = [];
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "delta") answer += event.text;
          if (event.type === "citations") citations = event.citations;
          if (event.type === "error") throw new Error(event.message);
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message !== "Unexpected end of JSON input"
          )
            throw parseError;
        }
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer, citations },
      ]);
    } catch {
      setError("Couldn’t reach the knowledge assistant. Try again.");
    } finally {
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
        </header>

        <section
          className="conversation"
          aria-live="polite"
          aria-label="Conversation"
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
              {messages.map((message, index) => (
                <article
                  className={`message ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <div className="message-label">
                    {message.role === "user" ? "You" : "PlacidWay assistant"}
                  </div>
                  <p>{message.text}</p>
                  {message.citations?.length ? (
                    <div className="citations">
                      <span>Sources</span>
                      {message.citations.map((citation) => (
                        <a
                          key={citation.url}
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {citation.title} ↗
                        </a>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              {loading ? (
                <article className="message assistant">
                  <div className="message-label">PlacidWay assistant</div>
                  <div className="typing">
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
              ) : null}
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
            disabled={loading}
          />
          <button
            type="submit"
            aria-label="Send question"
            disabled={loading || !question.trim()}
          >
            <span>Ask</span>
            <b>↑</b>
          </button>
        </form>
        {error ? (
          <div className="error-message" role="alert">
            {error} <button onClick={() => void submit()}>Retry</button>
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
