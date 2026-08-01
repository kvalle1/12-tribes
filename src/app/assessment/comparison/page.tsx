import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordSets } from "@/lib/observer/repository";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated the
 * same way as the saved result: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there's nothing to compare against without a self result).
 *
 * The Subject's Observers are loaded as anonymous word sets and folded into an
 * equal-weight "others" profile by `aggregateObservers`; the report itself
 * enforces the ≥3-response unlock and renders either the comparison or the
 * locked state.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordSets = await getObserverWordSets(session.user.id);
  const aggregate = aggregateObservers(observerWordSets);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ComparisonReport selfWords={row.words} aggregate={aggregate} />
      </div>
    </main>
  );
}
