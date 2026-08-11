import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { buildComparisonReport } from "@/lib/observer/report";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated:
 * an unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's no "self" to compare
 * against otherwise).
 *
 * All the scoring and aggregation happen server-side here — the Subject's own
 * words are re-scored and the anonymous Observer responses are aggregated with
 * equal weight — then handed to `ComparisonReport` as a plain view model, so the
 * word→tribe mapping never crosses to the client (ADR-0009). The report gates
 * itself to the ≥3-Observer unlock; below that it renders only a progress state.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverWordLists(session.user.id);
  const report = buildComparisonReport(row.words, observerWordLists);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport report={report} />
      </div>
    </main>
  );
}
