import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9): the Subject's own profile beside the
 * equal-weight aggregate of their anonymous Observers (ADR-0003). Login-gated
 * like the rest of the assessment — an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there is no self profile to compare against yet).
 *
 * The report unlocks only once at least `MIN_OBSERVERS` Observers have responded,
 * so the aggregate is meaningful and no single anonymous Observer can be singled
 * out. Below that threshold the page renders a clear locked state showing how
 * many more responses are needed.
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

  const observerResponses = await getObserverWordLists(session.user.id);
  const unlocked = isReportUnlocked(observerResponses.length);

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
            words={row.words}
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
 * The pre-unlock state: shown until at least `MIN_OBSERVERS` Observers respond.
 * It reports progress toward the threshold and points the Subject back to their
 * result page, where the shareable observer link lives.
 */
function LockedReport({ responseCount }: { responseCount: number }) {
  const remaining = Math.max(MIN_OBSERVERS - responseCount, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. others
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS} people have
        described you. That keeps the &ldquo;others&rdquo; view meaningful and
        every observer anonymous.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className={
                i < responseCount
                  ? "h-2.5 w-10 rounded-full bg-gold"
                  : "h-2.5 w-10 rounded-full bg-hair"
              }
            />
          ))}
        </div>
        <span className="text-[14px] text-muted">
          {responseCount} of {MIN_OBSERVERS} responded
        </span>
      </div>

      <p className="mt-8 text-[15px] text-ink">
        {remaining === 1
          ? "Just one more observer to go."
          : `${remaining} more observers to go.`}
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your shareable observer link
        </Link>
      </div>
    </div>
  );
}
