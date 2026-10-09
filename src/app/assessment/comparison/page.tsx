import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { OBSERVER_UNLOCK_THRESHOLD } from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight aggregate of their anonymous Observers, unlocked only
 * once at least `OBSERVER_UNLOCK_THRESHOLD` observers have responded.
 *
 * Login-gated like the rest of the Self flow: an unauthenticated visitor is
 * routed through sign-in, and a signed-in user who hasn't taken the assessment
 * is sent to start it (there is nothing to compare against yet). Below the
 * threshold the page renders a clear locked state rather than a partial report.
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

  const observers = await getObserverResponses(session.user.id);
  const unlocked = observers.length >= OBSERVER_UNLOCK_THRESHOLD;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {unlocked ? (
          <ComparisonReport
            selfWords={row.words}
            observerWordLists={observers.map((o) => o.words)}
          />
        ) : (
          <LockedState count={observers.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown before the report unlocks. Names exactly how many more Observers are
 * needed, so the wait is concrete rather than a dead end.
 */
function LockedState({ count }: { count: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted">
        The comparison opens once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have responded — enough for an honest average, and enough to keep each
        observer anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] leading-none">
          {count}
          <span className="text-[22px] text-faint">
            {" "}
            / {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your share link
        </Link>
      </div>
    </div>
  );
}
