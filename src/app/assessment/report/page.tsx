import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  MIN_OBSERVERS,
  isObserverReportUnlocked,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated: an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there is no Subject to compare against yet).
 *
 * The report unlocks only once at least three Observers have responded — below
 * that it shows a clear locked state rather than a thin, potentially
 * de-anonymizing average. Once unlocked, `ComparisonReport` renders the Subject's
 * own profile beside the equal-weight "others" profile plus the anonymous
 * per-Observer drill-down.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerResponses = await getObserverResponses(session.user.id);
  const unlocked = isObserverReportUnlocked(observerResponses.length);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {unlocked ? (
          <ComparisonReport
            selfWords={row.words}
            observerResponses={observerResponses}
          />
        ) : (
          <LockedReport responseCount={observerResponses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: the report is held back until at least `MIN_OBSERVERS`
 * people have responded, both so the "others" average is meaningful and so no
 * individual Observer can be singled out. Shows how many more responses are
 * needed and a route back to share the observer link.
 */
function LockedReport({ responseCount }: { responseCount: number }) {
  const remaining = MIN_OBSERVERS - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        A few more voices needed
      </h1>
      <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        described you. That keeps the &ldquo;others&rdquo; view meaningful and
        every observer anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-semibold leading-none text-gold">
            {responseCount}
          </span>
          <span className="text-[15px] text-muted">
            of {MIN_OBSERVERS} responses so far
          </span>
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link
        </Link>
      </div>
    </div>
  );
}
