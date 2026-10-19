import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  orderObserverResponses,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003). Login-gated like the
 * rest of the assessment: an unauthenticated visitor routes through sign-in, and
 * a signed-in user who hasn't taken the assessment is sent to start it (there is
 * no Subject to compare against without a saved result).
 *
 * The report unlocks only once at least `MIN_OBSERVERS` Observers have responded,
 * so the "others" view is statistically meaningful and no single Observer can be
 * singled out. Before then the page shows a clear locked state with how many
 * more responses are needed; after, it renders the full self-vs-others
 * comparison.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  // Order the responses by content, not submission time, so the anonymous
  // drill-down labels can't be mapped back to who replied when (see
  // `orderObserverResponses`). The equal-weight average is order-independent.
  const responses = orderObserverResponses(
    await getObserverResponsesForSubject(session.user.id),
  );

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isReportUnlocked(responses.length) ? (
          <ComparisonReport selfWords={row.words} responses={responses} />
        ) : (
          <LockedReport observerCount={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: the report is held back until at least `MIN_OBSERVERS`
 * Observers respond. Shows the current count and how many more are needed so the
 * Subject knows exactly where they stand without revealing anything about who
 * has or hasn't answered.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS} people have
        responded — enough that the &ldquo;others&rdquo; view is meaningful and
        no single response can be singled out.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair bg-white/40 px-6 py-5">
        <p className="text-[12px] uppercase tracking-[0.18em] text-faint">
          Responses so far
        </p>
        <p className="mt-2 font-serif text-[40px] leading-none text-ink">
          {observerCount}{" "}
          <span className="text-[20px] text-muted">/ {MIN_OBSERVERS}</span>
        </p>
        <p className="mt-3 text-[15px] text-muted">
          {remaining === 1
            ? "One more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your share link
        </Link>
      </div>
    </div>
  );
}
