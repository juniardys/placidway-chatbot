"use client";
import { useState } from "react";
export function ChatShell() {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    setA("");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const text = await r.text();
    setA(
      text
        .split("data: ")
        .filter(Boolean)
        .map((x) => {
          try {
            return JSON.parse(x).text ?? "";
          } catch {
            return "";
          }
        })
        .join(""),
    );
    setLoading(false);
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">PlacidWay Knowledge Chatbot</h1>
      <p>Answers use approved PlacidWay content.</p>
      <div
        aria-live="polite"
        className="min-h-32 rounded-2xl bg-white p-5 shadow-sm"
      >
        {a ||
          "Ask about treatments, packages, clinics, destinations, or prices."}
      </div>
      <div className="flex gap-3">
        <input
          aria-label="Question"
          className="min-h-11 flex-1 rounded-xl border p-3"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <button
          className="min-h-11 rounded-xl bg-slate-900 px-5 text-white active:scale-[0.96]"
          onClick={() => void submit()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Ask"}
        </button>
      </div>
    </main>
  );
}
