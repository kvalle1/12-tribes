import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverAggregate } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9): their own Self Assessment
 * profile beside the equal-weight "others" profile, unlocked once at least three
 * Observers have responded (ADR-0003). Login-gated exactly like the result page
 * — an unauthenticated visitor is routed through sign-in, and a signed-in user
 * who hasn't taken the assessment is sent to start it (there's no self profile
 * to compare against yet).
 *
 * All the scoring, aggregation, and the unlock decision live in the pure core;
 * this page only fetches the Subject's saved words and their Observer aggregate
 * and hands both to `ComparisonReport`.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const aggregate = await getObserverAggregate(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport words={row.words} aggregate={aggregate} />
      </div>
    </main>
  );
}
