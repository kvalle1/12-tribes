import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { score } from "@/lib/assessment/score";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * tied to the signed-in Subject's own saved result: an unauthenticated visitor
 * is routed through sign-in, and a signed-in user without a saved result is sent
 * to take the assessment first.
 *
 * The report unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * observers have responded — before then it shows a clear locked state with
 * progress toward the threshold. All scoring and the equal-weight aggregation
 * run here on the server; the view receives only computed numbers (ADR-0009).
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverResponses(session.user.id);
  const observerCount = observerWordLists.length;

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
            {...aggregateObservers(observerWordLists)}
          />
        ) : (
          <LockedState observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * observers respond. It explains why the report is held (the average only means
 * something, and individual anonymity only holds, once a few people answer) and
 * shows progress toward the threshold without revealing anything about who, if
 * anyone, has already responded.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = Math.max(OBSERVER_UNLOCK_THRESHOLD - observerCount, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        The comparison opens once{" "}
        <span className="text-ink">at least {OBSERVER_UNLOCK_THRESHOLD}</span>{" "}
        people have answered anonymously. Waiting for a few keeps every
        individual read private and makes the combined read worth trusting.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {observerCount}{" "}
          <span className="text-[20px] text-muted">
            of {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <ul className="mt-5 flex gap-2" aria-hidden>
          {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
            <li
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < observerCount ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </ul>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <div className="mt-10">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link →
        </Link>
      </div>
    </div>
  );
}
