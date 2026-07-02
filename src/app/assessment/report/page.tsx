import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  canUnlockReport,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9): the Subject's own profile beside the
 * equal-weight aggregated "others" profile, closing the 360 loop (ADR-0003).
 *
 * Login-gated like the rest of the assessment. Scoring and aggregation run here,
 * server-side — the page imports the `server-only` scoring core and observer
 * repository, computes the normalized profiles, and hands the presentational
 * `ComparisonReport` only tribe scores (no word→tribe mapping crosses to the
 * client, ADR-0009).
 *
 * The report unlocks only once at least three observers have responded
 * (`MIN_OBSERVERS_TO_UNLOCK`). Below that we render a clear locked state so an
 * individual observer can't be identified and the average stays meaningful.
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

        {canUnlockReport(aggregate.observerCount) ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.scores}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedReport observerCount={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before three observers have responded. States plainly
 * how many have answered and how many are still needed, and points the Subject
 * back to their result to copy the observer link.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        A few more reads to go
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS_TO_UNLOCK} people
        have answered — that keeps every observer anonymous and makes the
        &ldquo;others&rdquo; average meaningful.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-semibold leading-none text-gold tabular-nums">
            {observerCount}
          </span>
          <span className="text-[14px] text-muted">
            of {MIN_OBSERVERS_TO_UNLOCK} responses in
          </span>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS_TO_UNLOCK} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(observerCount / MIN_OBSERVERS_TO_UNLOCK) * 100}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {observerCount === 0
            ? "No one has responded yet."
            : `${remaining} more ${remaining === 1 ? "response" : "responses"} needed to unlock.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
