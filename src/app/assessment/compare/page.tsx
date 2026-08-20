import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { listObserverResponses } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated,
 * like the result page: an unauthenticated visitor routes through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` Observers
 * have responded (PRD story 23) — before then the "others" view would be too
 * thin to be meaningful and individual Observers could be de-anonymized, so a
 * clear locked state shows progress toward the threshold instead. Scoring and
 * aggregation run server-side; only computed numbers reach the client.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await listObserverResponses(session.user.id);

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
          <ComparisonReport selfWords={row.words} observerResponses={responses} />
        ) : (
          <LockedState count={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until the ≥3-Observer threshold is met: what the report is, and how many
 * more responses are needed before it unlocks.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Locked until three observers respond
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have anonymously described you. Keeping it locked until then makes the
        &ldquo;others&rdquo; view meaningful and keeps individual observers
        anonymous.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-10 rounded-full ${
                i < count ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-muted">
          {count} of {MIN_OBSERVERS_FOR_REPORT} responses so far
          {remaining > 0 && (
            <>
              {" "}
              — {remaining} more to go
            </>
          )}
        </p>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <p className="max-w-[520px] text-[15px] text-muted">
          Share your observer link with a few more people who know you well.
        </p>
        <Link
          href="/assessment/result"
          className="mt-5 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
