import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponseWords } from "@/lib/observer/repository";
import {
  hasEnoughObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report page (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (there's nothing to compare
 * against yet).
 *
 * The report unlocks only once at least `MIN_OBSERVERS_TO_UNLOCK` observers have
 * responded — before then the page shows a clear locked state with how many
 * reads are still needed, so the average stays meaningful and no single
 * anonymous observer can be singled out.
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

  const observerResponses = await getObserverResponseWords(session.user.id);
  const unlocked = hasEnoughObservers(observerResponses.length);

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
            words={row.words}
            observerResponses={observerResponses}
          />
        ) : (
          <LockedState responded={observerResponses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown before the report unlocks: how many reads are in and how many remain
 * before the equal-weight comparison becomes available.
 */
function LockedState({ responded }: { responded: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - responded;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not enough reads yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        The comparison opens once at least {MIN_OBSERVERS_TO_UNLOCK} people have
        answered — enough for the average to mean something and to keep each
        anonymous read from standing alone. So far{" "}
        <span className="text-ink">
          {responded} of {MIN_OBSERVERS_TO_UNLOCK}
        </span>{" "}
        {responded === 1 ? "person has" : "people have"} responded; {remaining}{" "}
        more to go.
      </p>

      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
          <span
            key={i}
            className={
              i < responded
                ? "h-2.5 flex-1 rounded-full bg-gold"
                : "h-2.5 flex-1 rounded-full bg-hair"
            }
          />
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Back to your result to share the link
        </Link>
      </div>
    </div>
  );
}
