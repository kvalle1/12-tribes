import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { aggregateObservers } from "@/lib/observer/aggregate";
import { score } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS_FOR_REPORT,
  isReportUnlocked,
} from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated to
 * the Subject: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the Self Assessment is sent to start it (there
 * is nothing to compare against without a self result).
 *
 * The report unlocks only once at least three Observers have responded — before
 * that the "others" view would neither be a meaningful aggregate nor keep
 * individual Observers anonymous, so a locked state is shown with progress
 * toward the threshold. Everything is computed on the server (the scoring core
 * and `aggregateObservers` are `server-only`); only the resulting per-tribe
 * numbers are handed to the client view.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const { observerCount, scores: others, perObserver } =
    aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isReportUnlocked(observerCount) ? (
          <ComparisonReport
            self={score(row.words)}
            others={others}
            perObserver={perObserver}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        ) : (
          <LockedReport observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least three Observers have responded. Reports how many are in
 * and how many more are needed, and points back to the share link so the Subject
 * can invite more people.
 */
function LockedReport({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs 360
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.03]">
        Your comparison is almost ready
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] text-muted">
        The comparison report unlocks once at least {MIN_OBSERVERS_FOR_REPORT}{" "}
        people have answered — enough that the &ldquo;others&rdquo; view is a
        real aggregate and no single person can be singled out.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[40px] font-semibold leading-none text-gold">
            {observerCount}
            <span className="text-[22px] text-muted"> / {MIN_OBSERVERS_FOR_REPORT}</span>
          </span>
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            {observerCount === 1 ? "response in" : "responses in"}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(
                (observerCount / MIN_OBSERVERS_FOR_REPORT) * 100,
                100,
              )}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your report opens."
            : `${remaining} more responses and your report opens.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more people
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Share your observer link with a few more people who know you well. Each
          one answers anonymously.
        </p>
        <div className="mt-5">
          <Link
            href="/assessment/result"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Get your share link
          </Link>
        </div>
      </div>
    </div>
  );
}
