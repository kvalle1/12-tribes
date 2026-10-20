import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordSets } from "@/lib/observer/repository";
import {
  isComparisonUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the signed-in Subject's own
 * profile against the equal-weight average of their anonymous Observers.
 *
 * Login-gated like the rest of the assessment — an unauthenticated visitor is
 * routed through sign-in, and a signed-in user who hasn't taken the assessment
 * is sent to start it (there's no "others" to compare against without a self
 * read and a share link). The report stays locked until at least three
 * Observers have responded, both so the average is meaningful and so no single
 * anonymous Observer can be singled out.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordSets = await getObserverWordSets(session.user.id);
  const observerCount = observerWordSets.length;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isComparisonUnlocked(observerCount) ? (
          <ComparisonReport
            selfWords={row.words}
            observerWordSets={observerWordSets}
          />
        ) : (
          <LockedState observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how many Observers have responded, how many more are
 * needed, and a nudge back to the share link. Deliberately shows only a count —
 * never who has or hasn't responded — so anonymity holds even before unlock.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Still gathering reads
      </h1>
      <p className="mt-5 max-w-[520px] text-[16px] text-muted">
        Your comparison report unlocks once{" "}
        <span className="text-ink">{MIN_OBSERVERS_FOR_REPORT} people</span> have
        shared how they see you. That floor keeps the average meaningful and
        every response anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[20px]">
            {observerCount} / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(observerCount / MIN_OBSERVERS_FOR_REPORT, 1) * 100}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
        </Link>
        <span className="max-w-[320px] text-[13px] text-faint">
          Send it to a few more people who know you well.
        </span>
      </div>
    </div>
  );
}
