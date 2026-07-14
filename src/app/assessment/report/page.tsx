import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  scoreObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * against the equal-weight aggregate of how their anonymous Observers see them.
 *
 * Login-gated — a Subject can only ever see the report about themselves. The
 * report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` observers have
 * responded, which keeps the average meaningful and preserves each observer's
 * anonymity; before then a clear locked state points the Subject back to their
 * shareable link. All scoring and the equal-weight aggregation run here on the
 * server (ADR-0009); only plain score numbers reach the view.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
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

        {responses.length < MIN_OBSERVERS_FOR_REPORT ? (
          <LockedReport count={responses.length} />
        ) : (
          <ComparisonReport
            self={score(row.words)}
            others={aggregateObservers(responses)}
            observerProfiles={scoreObservers(responses)}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS_FOR_REPORT` observers respond. Names the
 * current count and how many remain, and routes the Subject back to their
 * result page to copy and re-share the observer link.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Not quite yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        Your comparison report unlocks once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have described you. Keeping it closed
        until then makes the &ldquo;others&rdquo; read meaningful and protects
        each observer&rsquo;s anonymity.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[40px] font-semibold text-gold tabular-nums">
            {count}
          </span>
          <span className="text-[14px] text-muted">
            of {MIN_OBSERVERS_FOR_REPORT} responses so far
          </span>
        </div>
        <p className="mt-3 text-[15px] text-ink">
          {remaining === 1
            ? "Just one more observer and your report unlocks."
            : `${remaining} more observers and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
