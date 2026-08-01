"use client";

import { useState } from "react";

/**
 * Anonymous per-observer drill-down for the 360 comparison report (issue #9,
 * ADR-0003). Each Observer is shown only as "Observer 1 / 2 / 3…" with no name,
 * relationship, or any other attribute — the ordering is the stable
 * oldest-first sequence from the server, carrying no identifying meaning.
 *
 * Every value here is pre-computed on the server (tribe name, accent colour,
 * bar fraction); this component is purely presentational, so no scoring logic or
 * word→tribe mapping ever reaches the client (ADR-0009 trust boundary).
 */
export interface ObserverRead {
  /** This Observer's top tribes, highest first, ready to render. */
  top: {
    slug: string;
    name: string;
    accent: string;
    /** 0–1 bar-fill fraction relative to this Observer's own top score. */
    relative: number;
  }[];
}

export function ObserverDrilldown({ observers }: { observers: ObserverRead[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-2.5">
      {observers.map((observer, index) => (
        <ObserverRow
          key={index}
          label={`Observer ${index + 1}`}
          read={observer}
        />
      ))}
    </ul>
  );
}

function ObserverRow({ label, read }: { label: string; read: ObserverRead }) {
  const [open, setOpen] = useState(false);
  const lead = read.top[0];

  return (
    <li className="rounded-[2px] border border-hair">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-hair/20"
      >
        <span className="flex items-baseline gap-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            {label}
          </span>
          {lead && (
            <span
              className="font-serif text-[16px]"
              style={{ color: lead.accent }}
            >
              {lead.name}
            </span>
          )}
        </span>
        <span
          className="text-[14px] text-faint transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
          aria-hidden
        >
          →
        </span>
      </button>

      {open && (
        <ul className="flex flex-col gap-2.5 border-t border-hair px-4 py-4">
          {read.top.map((row) => (
            <li
              key={row.slug}
              className="grid grid-cols-[110px_1fr] items-center gap-3 max-[520px]:grid-cols-[88px_1fr]"
            >
              <span className="font-serif text-[15px] leading-none">
                {row.name}
              </span>
              <div
                className="h-2 overflow-hidden rounded-full bg-hair/50"
                role="img"
                aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of this observer's top score`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(row.relative * 100, row.relative > 0 ? 3 : 0)}%`,
                    backgroundColor: row.accent,
                    opacity: 0.75,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
