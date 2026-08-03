import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  compareProfiles,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The self-vs-others comparison report (issue #9, ADR-0003) — the close of the
 * 360 loop. Login-gated like the rest of the assessment: an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment yet is sent to start it (there's nothing to compare against).
 *
 * All scoring runs here on the server: the Subject's own profile and the
 * equal-weight aggregation of the anonymous observer responses. The report
 * unlocks only once at least `MIN_OBSERVERS` observers have responded; before
 * then a clear locked state explains how many more reads are needed.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregated = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isComparisonUnlocked(aggregated.observerCount) ? (
          <ComparisonReport
            rows={compareProfiles(score(row.words), aggregated.scores)}
            perObserver={aggregated.perObserver}
          />
        ) : (
          <LockedState observerCount={aggregated.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: the report is held back until at least `MIN_OBSERVERS`
 * anonymous observers have responded, both so the average is meaningful and so
 * no single observer is identifiable. Tells the Subject exactly how many reads
 * are in and how many more are needed, and points them back to their share link.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Self vs. 360
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison opens once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS}</span> people have
        described you. That keeps the &ldquo;how others see you&rdquo; read
        meaningful and every observer anonymous.
      </p>

      <div className="mt-10 flex items-center gap-4">
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < observerCount ? "bg-gold" : "border border-hair bg-transparent"
            }`}
            aria-hidden
          />
        ))}
        <span className="text-[14px] text-muted">
          {observerCount} of {MIN_OBSERVERS} responses in
        </span>
      </div>

      <p className="mt-10 max-w-[540px] text-[15px] text-muted">
        {remaining === 1
          ? "Just one more response and your comparison unlocks."
          : `Share your link with a few more people — ${remaining} more responses and it unlocks.`}
      </p>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        Get your share link
      </Link>
    </div>
  );
}
