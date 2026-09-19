import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * scoped to the signed-in Subject: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is nothing to compare against yet).
 *
 * Both the Subject's own profile and the "others" profile are computed on the
 * server — `score` and `aggregateObservers` are server-only — and only the
 * resulting plain scores are handed to the presentational report, so the
 * word→tribe mapping never reaches the client (ADR-0009). The report itself
 * renders a locked state until at least three Observers have responded.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const self = score(row.words);
  const aggregate = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport self={self} aggregate={aggregate} />
      </div>
    </main>
  );
}
