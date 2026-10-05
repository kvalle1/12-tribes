"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { shouldShowResultsEntry } from "@/lib/profile/results-entry";

/**
 * Home-page "View your results" shortcut (issue #18).
 *
 * Resolved on the client so the home page itself can stay static (the same
 * pattern the nav's `AuthNav` already uses). It shows only for a signed-in user
 * who has a saved result: `useSession()` gives the auth status, and a single
 * fetch to `/api/profile` supplies the `hasResult` fact without ever pulling
 * the result data (or the server-only scoring) into the client bundle. The
 * show/hide decision itself lives in the pure, unit-tested
 * `shouldShowResultsEntry`.
 *
 * While the session is loading or the user is signed out, nothing renders, so
 * the entry never flashes before dead-ending at sign-in or the assessment.
 */
export function ViewResultsEntry() {
  const { status } = useSession();
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    // Only fetch once the session is known to be authenticated. For any other
    // status the render guard below already hides the entry, so there's nothing
    // to set here — and setting state synchronously in an effect is both
    // unnecessary and a lint error. State is only updated from the async
    // callbacks, keyed to this run via `active` so a stale response can't win.
    if (status !== "authenticated") return;

    let active = true;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : { hasResult: false }))
      .then((data) => {
        if (active) setHasResult(Boolean(data?.hasResult));
      })
      .catch(() => {
        if (active) setHasResult(false);
      });

    return () => {
      active = false;
    };
  }, [status]);

  if (!shouldShowResultsEntry(status, hasResult)) return null;

  return (
    <Link
      href="/profile"
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      View your results
    </Link>
  );
}
