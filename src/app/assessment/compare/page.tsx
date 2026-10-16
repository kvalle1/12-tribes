import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report for the signed-in Subject (issue #9, ADR-0003):
 * their own read beside the equal-weight "others" read aggregated from their
 * anonymous Observers.
 *
 * Login-gated like the rest of the result surface (ADR-0004): an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there is no Subject profile to compare against
 * yet). The Subject's words and the Observer responses are fetched server-side
 * and handed to `ComparisonReport`, which scores and gates them — scoring never
 * reaches the client (ADR-0009).
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport selfWords={row.words} responses={responses} />
      </div>
    </main>
  );
}
