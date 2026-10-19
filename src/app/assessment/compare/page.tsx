import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003) — their own read set
 * beside the equal-weight aggregated "others" read. Login-gated like the rest of
 * the Self flow: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it (there can
 * be no observers, and so no comparison, without a result to share).
 *
 * All scoring and aggregation runs here on the server; the client only ever
 * receives the computed scores (ADR-0009). The report component itself renders
 * the locked state until at least three observers have responded.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const self = score(row.words);
  const responses = await getObserverResponsesForSubject(session.user.id);
  const aggregate = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ComparisonReport self={self} aggregate={aggregate} />
      </div>
    </main>
  );
}
