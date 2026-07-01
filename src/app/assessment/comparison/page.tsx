import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";
import { OBSERVER_UNLOCK_THRESHOLD } from "@/lib/assessment/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9, ADR-0003). Login-gated and for the
 * Subject only: it compares the Subject's own Self Assessment profile with the
 * equal-weight aggregated "others" profile built from anonymous observer
 * responses.
 *
 * All scoring runs here on the server — self scoring and `aggregateObservers`
 * both sit behind the `server-only` trust boundary (ADR-0009) — and only plain
 * `TribeScore` data is handed to the client `ComparisonReport`. The report
 * unlocks only once at least `OBSERVER_UNLOCK_THRESHOLD` observers have
 * responded; below that a clear locked state is shown instead, both so the
 * average is meaningful and so no single observer can be identified.
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
  const { count, others, observers } = aggregateObservers(responses);
  const unlocked = count >= OBSERVER_UNLOCK_THRESHOLD;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          A 360 reflection
        </p>
        <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
          You, seen from the outside
        </h1>

        {unlocked ? (
          <>
            <p className="mt-4 max-w-[520px] text-[16px] text-muted">
              How you see yourself, next to how {count} people who know you read
              you. Where the two diverge is the most useful thing here.
            </p>
            <div className="mt-12">
              <ComparisonReport
                self={score(row.words)}
                others={others}
                observers={observers}
              />
            </div>
          </>
        ) : (
          <LockedState count={count} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `OBSERVER_UNLOCK_THRESHOLD` observers respond. Reveals
 * nothing about the "others" profile — only how many have responded and how many
 * more are needed — so anonymity holds until aggregation is meaningful.
 */
function LockedState({ count }: { count: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;

  return (
    <div className="mt-10 rounded-[2px] border border-hair p-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Not unlocked yet
      </p>
      <p className="mt-4 text-[18px] leading-relaxed text-ink">
        {count === 0
          ? "No one has responded yet."
          : count === 1
            ? "One person has responded so far."
            : `${count} people have responded so far.`}{" "}
        Your comparison unlocks once{" "}
        <span className="text-gold">{OBSERVER_UNLOCK_THRESHOLD}</span> people
        have shared their read — {remaining} more to go. Keeping it locked until
        then makes the &ldquo;others&rdquo; view meaningful and keeps every
        response anonymous.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${count} of ${OBSERVER_UNLOCK_THRESHOLD} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(count / OBSERVER_UNLOCK_THRESHOLD, 1) * 100}%`,
            }}
          />
        </div>
        <span className="shrink-0 text-[12px] tracking-[0.06em] text-faint">
          {count} / {OBSERVER_UNLOCK_THRESHOLD}
        </span>
      </div>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Get your observer link to invite more people
      </Link>
    </div>
  );
}
