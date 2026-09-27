"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Home-page "View your results" entry (issue #18, PRD story 16). It links a
 * signed-in Subject back to their profile without retaking the assessment.
 *
 * It renders only when the viewer is signed in AND has a saved result: signed-out
 * visitors and signed-in users who haven't taken the assessment yet see nothing.
 * Like `AuthNav`, this reads the session on the client via `useSession()` so the
 * home page stays statically rendered; the one server-truth bit it needs — does
 * this account have a result — comes from `/api/profile/status`. Nothing renders
 * until that's confirmed, so there's no flash of a link the viewer can't use.
 */
export function ViewResultsEntry() {
  const { status } = useSession();
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    // Only ask once signed in. When signed out, the render guard below hides the
    // entry regardless of `hasResult`, so no synchronous reset is needed here.
    if (status !== "authenticated") return;

    let active = true;
    fetch("/api/profile/status")
      .then((res) => (res.ok ? res.json() : { hasResult: false }))
      .then((data: { hasResult?: boolean }) => {
        if (active) setHasResult(Boolean(data.hasResult));
      })
      .catch(() => {
        /* transient failure — leave the entry hidden rather than guess */
      });

    return () => {
      active = false;
    };
  }, [status]);

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
