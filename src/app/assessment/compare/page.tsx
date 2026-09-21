import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { aggregateObservers, MIN_OBSERVERS } from "@/lib/observer/aggregate";
import { score } from "@/lib/assessment/score";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated and private to the
 * Subject: only the signed-in owner of the result sees how their observers read
 * them. A signed-in user who hasn't taken the assessment is sent to start it —
 * there's nothing to compare against without their own result.
 *
 * All scoring runs here on the server (`score`, `aggregateObservers` are
 * `server-only`); the report component receives plain data. The report unlocks
 * only once at least {@link MIN_OBSERVERS} observers have responded — before then
 * a locked state shows progress and points back to the share link.
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
  const others = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {others.unlocked ? (
          <ComparisonReport
            self={score(row.words)}
            others={others.scores}
            perObserver={others.perObserver}
            observerCount={others.observerCount}
          />
        ) : (
          <LockedState count={others.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until at least {@link MIN_OBSERVERS} observers have
 * responded. It reports progress honestly and sends the Subject to the share
 * link so they can invite more — the report stays sealed until the average is
 * meaningful and individual anonymity is preserved (ADR-0003).
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-3 max-w-[540px] text-[15px] text-muted">
        Your comparison opens once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS}</span> people have
        answered. Keeping it sealed until then makes the average meaningful and
        keeps every individual read anonymous.
      </p>

      {/* Progress dots — filled for each response received. */}
      <div
        className="mt-8 flex items-center gap-2.5"
        role="img"
        aria-label={`${count} of ${MIN_OBSERVERS} responses received`}
      >
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${
              i < count ? "bg-gold" : "border border-hair bg-transparent"
            }`}
          />
        ))}
        <span className="ml-2 text-[13px] text-muted">
          {count} of {MIN_OBSERVERS} in
        </span>
      </div>

      <p className="mt-8 max-w-[540px] text-[15px] text-ink">
        {count === 0
          ? "No one has responded yet."
          : remaining === 1
            ? "Just one more response to go."
            : `${remaining} more responses to go.`}{" "}
        Share your observer link with a few more people who know you well.
      </p>

      <div className="mt-8 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
