import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): how the Subject sees
 * themselves versus the equal-weight aggregate of how others see them.
 *
 * Login-gated like the result page. A signed-in user who hasn't taken the
 * assessment has nothing to compare against, so they're sent to start it. The
 * report itself stays locked until at least `MIN_OBSERVERS_FOR_REPORT` Observers
 * have responded — both so the average is meaningful and so no single Observer
 * is identifiable within it.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregate = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {aggregate.unlocked ? (
          <ComparisonReport
            selfWords={row.words}
            primarySlug={row.primarySlug}
            aggregate={aggregate}
          />
        ) : (
          <LockedReport count={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state, shown until enough Observers have responded. It reports
 * progress toward the threshold without revealing any Observer's answer (that
 * would break anonymity before the aggregate is safe), and points the Subject
 * back to their result where the shareable observer link lives.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] text-muted">
        Your report opens once at least {MIN_OBSERVERS_FOR_REPORT} people have
        anonymously shared how they see you. Until then it stays sealed — both so
        the &ldquo;others&rdquo; view is meaningful and so no single response can
        be singled out.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px]">
            <span className="text-gold">{count}</span> / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div className="mt-4 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <div
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair/50"
              }`}
            />
          ))}
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
        <span className="text-[13px] text-faint">
          Send it to a few people who know you well.
        </span>
      </div>
    </div>
  );
}
