"use client";

import { FormEvent, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function LeadForm({ sessionId }: { sessionId?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, sessionId }),
      });
      setStatus(response.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent")
    return (
      <p className="lead-form-done" role="status">
        Thanks, {name.trim()}. PlacidWay will contact you at {email.trim()} with a free quote.
      </p>
    );

  return (
    <form className="lead-form" onSubmit={onSubmit} aria-label="Request a free quote">
      <p className="lead-form-title">Request a free quote</p>
      <div className="lead-form-row">
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
        </label>
      </div>
      <label>
        <span>What would you like a quote for? (optional)</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={2} />
      </label>
      <div className="lead-form-actions">
        <button type="submit" disabled={status === "sending" || !name.trim() || !email.trim()}>
          {status === "sending" ? "Sending…" : "Send request"}
        </button>
        {status === "error" ? <span role="alert">Couldn’t send. Please try again.</span> : null}
      </div>
      <p className="lead-form-note">Your details are shared only with PlacidWay to prepare your quote.</p>
    </form>
  );
}
