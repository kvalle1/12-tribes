import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import {
  isComparisonUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { ComparisonView } from "@/components/comparison-view";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * next to the equal-weight aggregate of how their anonymous Observers see them.
 *
 * Login-gated like the rest of the assessment flow — an unauthenticated visitor
 * is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it. The report unlocks only once at least
 * {@link OBSERVER_UNLOCK_THRESHOLD} Observers have responded; before then a clear
 * locked state explains how close they are, and no aggregation is computed or
 * rendered.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverWordLists(session.user.id);
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

        {isComparisonUnlocked(observerCount) ? (
          <ComparisonView
            words={row.words}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
            observerWordLists={observerWordLists}
          />
        ) : (
          <LockedState count={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until {@link OBSERVER_UNLOCK_THRESHOLD} Observers
 * have responded. It names how many more are needed and keeps the Subject
 * pointed at sharing their link, without hinting at who (if anyone) has already
 * answered beyond the running count — the aggregate only becomes meaningful, and
 * individual responses only become anonymous, at the threshold.
 */
function LockedState({ count }: { count: number }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How others see you
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Your 360 is still gathering
      </h1>
      <p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-muted">
        The comparison unlocks once{" "}
        <span className="text-ink">{OBSERVER_UNLOCK_THRESHOLD} people</span> have
        responded — enough for the picture to mean something and for every
        answer to stay anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </p>
        <p className="mt-2 font-serif text-[40px] leading-none">
          {count}
          <span className="text-[22px] text-muted"> / {OBSERVER_UNLOCK_THRESHOLD}</span>
        </p>
        <p className="mt-4 text-[15px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison opens up."
            : `${remaining} more responses and your comparison opens up.`}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
