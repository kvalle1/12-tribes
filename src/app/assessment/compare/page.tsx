import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor routes through sign-in, and a signed-in user who
 * hasn't taken the assessment yet is sent to start it (there'd be no self read
 * to compare against, and no share token for observers).
 *
 * The report unlocks only once at least three Observers have responded — below
 * that it renders a clear locked state instead, both so the equal-weight average
 * is meaningful and so no individual observer is identifiable. Scoring and
 * aggregation run here on the server; only computed scores reach the client
 * component (ADR-0009).
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

        {isReportUnlocked(responses.length) ? (
          <ComparisonReport
            selfScores={score(row.words)}
            aggregate={aggregateObservers(responses)}
          />
        ) : (
          <LockedState count={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS_FOR_REPORT` observers have responded. It
 * states how many more are needed without revealing anything about who has
 * already answered, preserving observer anonymity even before the unlock.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        The comparison opens once at least {MIN_OBSERVERS_FOR_REPORT} people have
        described you. That floor keeps the combined read meaningful and keeps
        each response anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {count}{" "}
          <span className="text-[20px] text-muted">
            / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
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
