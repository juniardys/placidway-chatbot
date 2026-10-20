"use client";

import { useEffect, useState } from "react";

export type StepKind = "thinking" | "search" | "sources" | "compose";
export type ActivityStep = {
  kind: StepKind;
  label: string;
  detail?: string;
  status: "running" | "done";
};

type Props = {
  steps: ActivityStep[];
  live: boolean;
  durationMs?: number;
  sourceCount: number;
};

export function AgentActivity({ steps, live, durationMs, sourceCount }: Props) {
  const [open, setOpen] = useState(live);

  // Follow the run: expanded while the agent works, folded once the answer lands.
  useEffect(() => setOpen(live), [live]);

  if (!steps.length) return null;
  const running = steps.find((step) => step.status === "running");
  const summary = live
    ? (running?.label ?? "Thinking")
    : [
        sourceCount ? `Checked ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : `Worked through ${steps.length} steps`,
        durationMs ? formatDuration(durationMs) : null,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className={`activity ${live ? "is-live" : ""} ${open ? "is-open" : ""}`}>
      <button type="button" className="activity-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="activity-orb" aria-hidden="true">
          {live ? <span className="orb-pulse" /> : <CheckIcon />}
        </span>
        <span className={`activity-summary ${live ? "shimmer" : ""}`}>{summary}</span>
        <ChevronIcon />
      </button>
      <div className="activity-body">
        <ol className="trail">
          {steps.map((step, index) => (
            <li key={`${step.kind}-${index}`} className={`trail-step ${step.status}`} style={{ animationDelay: `${index * 40}ms` }}>
              <span className="trail-node" aria-hidden="true">
                {step.status === "running" ? <span className="spinner" /> : <StepIcon kind={step.kind} />}
              </span>
              <div className="trail-copy">
                <span className="trail-label">{step.label}</span>
                {step.detail ? (
                  step.kind === "search" ? (
                    <code className="trail-query">{step.detail}</code>
                  ) : (
                    <span className="trail-detail">{step.detail}</span>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function formatDuration(ms: number) {
  const seconds = ms / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`;
}

function StepIcon({ kind }: { kind: StepKind }) {
  const paths: Record<StepKind, React.ReactNode> = {
    thinking: <path d="M8 2.5a4 4 0 0 0-2.4 7.2c.4.3.6.7.6 1.1v.7h3.6v-.7c0-.4.2-.8.6-1.1A4 4 0 0 0 8 2.5ZM6.4 13.5h3.2" />,
    search: (
      <>
        <circle cx="7" cy="7" r="4" />
        <path d="m10 10 3 3" />
      </>
    ),
    sources: <path d="M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12M6 8h4M6 10.5h4" />,
    compose: <path d="M3 13h3l7-7-3-3-7 7zM9 4l3 3" />,
  };
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="activity-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
