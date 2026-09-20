import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { MIN_OBSERVERS, hasEnoughObservers } from "@/lib/assessment/constants";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least three Observers have responded — below
 * that the "others" view would be statistically thin and could de-anonymize an
 * individual Observer, so a clear locked state shows progress toward the
 * threshold instead. Both the self and observer selections are scored here on the
 * server (the word→tribe mapping never reaches the client, ADR-0009).
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  // Independent reads keyed on the same user — fetch in parallel.
  const [row, observerWordSets] = await Promise.all([
    getCurrentResult(session.user.id),
    getObserverResponses(session.user.id),
  ]);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(observerWordSets.length) ? (
          <ComparisonReport
            selfWords={row.words}
            observerWordSets={observerWordSets}
          />
        ) : (
          <LockedState count={observerWordSets.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how many Observers have responded and how many are still
 * needed, with the share link entry point. Kept honest and specific — a bare
 * "locked" would leave the Subject unsure whether anything is happening.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not enough observers yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once{" "}
        <span className="text-ink">{MIN_OBSERVERS} observers</span> have
        responded — enough to keep each one anonymous and the picture meaningful.
        So far{" "}
        <span className="text-ink">
          {count} {count === 1 ? "observer has" : "observers have"}
        </span>{" "}
        answered; {remaining} more to go.
      </p>

      {/* Progress pips toward the threshold. */}
      <ul className="mt-8 flex gap-2.5" aria-label={`${count} of ${MIN_OBSERVERS} observers responded`}>
        {Array.from({ length: MIN_OBSERVERS }, (_, i) => (
          <li
            key={i}
            className={`h-2.5 w-16 rounded-full ${i < count ? "bg-gold" : "bg-hair/60"}`}
          />
        ))}
      </ul>

      <div className="mt-12 border-t border-hair pt-8">
        <p className="max-w-[520px] text-[15px] text-muted">
          Share your observer link with a few more people who know you well, then
          come back here.
        </p>
        <Link
          href="/assessment/result"
          className="mt-5 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
