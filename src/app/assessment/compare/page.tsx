import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import {
  MIN_OBSERVERS_FOR_REPORT,
  isReportUnlocked,
} from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated like the rest of
 * the assessment: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT}
 * Observers have responded. Below that it shows a clear locked state with the
 * shareable link and progress toward the threshold, rather than a thin or
 * potentially de-anonymizing comparison.
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
  const shareUrl = await observerShareUrl(row.shareToken);

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
          <LockedState count={responses.length} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked comparison report, shown until the ≥3-Observer threshold is met.
 * Surfaces how many more responses are needed and the shareable link so the
 * Subject can gather them.
 */
function LockedState({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not enough responses yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have described you. That keeps the &ldquo;others&rdquo; read broad enough
        to be fair — and anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px]">
            {count} / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(count / MIN_OBSERVERS_FOR_REPORT, 1) * 100}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Get a 360 read
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          Share your link
        </h2>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this to 3–5 people who know you well. Each one anonymously picks
          the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
