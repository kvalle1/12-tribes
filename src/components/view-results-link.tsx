"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

/**
 * Home-page "View your results" entry (#18). Shown only to a signed-in user who
 * has a saved current result, and hidden for everyone else.
 *
 * It runs on the client — the same pattern as `AuthNav` — so the landing page
 * (`/`) stays statically rendered instead of going dynamic to read the session
 * server-side. It only queries once the session is authenticated, so signed-out
 * visitors trigger no request. Returns nothing until a result is confirmed, so
 * there is no flash for users without one.
 */
export function ViewResultsLink() {
  const { status } = useSession();
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    fetch("/api/me/result")
      .then((r) => (r.ok ? r.json() : { hasResult: false }))
      .then((data: { hasResult?: boolean }) => {
        if (active) setHasResult(Boolean(data.hasResult));
      })
      .catch(() => {
        /* network hiccup — just don't show the optional entry */
      });
    return () => {
      active = false;
    };
  }, [status]);

  // Gate on `status` too, so the entry disappears immediately on sign-out even
  // though the last fetched `hasResult` lingers in state.
  if (status !== "authenticated" || !hasResult) return null;

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
