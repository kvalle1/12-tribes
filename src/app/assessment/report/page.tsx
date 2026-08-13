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
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated
 * like the result page: an unauthenticated visitor is routed through sign-in, a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report stays locked until at least three Observers have responded, so the
 * aggregated "others" view is meaningful and no single Observer can be singled
 * out. Below the threshold the page shows how many responses are in and how many
 * remain; at or above it, the full comparison renders.
 *
 * Server component: all scoring and aggregation run here (the `server-only`
 * scoring core), and only computed `TribeScore[]`s cross into the view — the
 * word→tribe mapping never reaches the client (ADR-0009).
 */
export default async function ReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const count = responses.length;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isReportUnlocked(count) ? (
          <ComparisonReport
            selfScores={score(row.words)}
            otherScores={aggregateObservers(responses)}
            observerProfiles={responses.map((r) => score(r.words))}
          />
        ) : (
          <LockedReport count={count} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: a clear explanation that the report opens once at least
 * three Observers respond, and where the count stands now. Never shows any
 * partial aggregation — with fewer than three responses an individual Observer
 * could otherwise be inferred (ADR-0003).
 */
function LockedReport({ count }: { count: number }) {
  const remaining = Math.max(0, MIN_OBSERVERS_FOR_REPORT - count);
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not open yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your report unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people have
        answered. That keeps the combined read meaningful and every observer
        anonymous — no one can be singled out from a handful of responses.
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[44px] font-semibold leading-none text-gold">
            {count}
          </span>
          <span className="text-[15px] text-muted">
            of {MIN_OBSERVERS_FOR_REPORT} responses so far
          </span>
        </div>
        <div
          className="mt-5 flex gap-2"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} observer responses received`}
        >
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="mt-6 max-w-[520px] text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your report opens."
            : `${remaining} more responses and your report opens.`}{" "}
          Share your observer link from your result page to invite more people.
        </p>
        <Link
          href="/assessment/result"
          className="mt-8 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Back to your result &amp; share link
        </Link>
      </div>
    </div>
  );
}
