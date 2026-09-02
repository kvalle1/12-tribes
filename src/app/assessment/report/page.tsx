import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregateObservers";
import { getTribeBySlug } from "@/lib/tribes";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): how others see them
 * set against their own read. Login-gated and self-only — a Subject sees their
 * own report, computed from the anonymous Observer responses tied to them.
 *
 * All scoring happens here on the server (the scoring core and the observers'
 * raw words never reach the client); the client component receives only the
 * resulting per-tribe numbers. The report is locked until at least
 * `MIN_OBSERVERS` Observers have responded — below that the equal-weight average
 * isn't meaningful and a lone Observer wouldn't stay anonymous.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const others = aggregateObservers(responses);
  const unlocked = isReportUnlocked(others.observerCount);

  const primary = getTribeBySlug(row.primarySlug);

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
          Your 360 report
        </p>
        <h1 className="mt-2 font-serif text-[clamp(32px,5vw,44px)] font-semibold leading-[1.05]">
          How others see you
        </h1>
        {primary && (
          <p className="mt-3 max-w-[520px] text-[15px] text-muted">
            You read yourself as{" "}
            <span className="text-gold">{primary.name}</span>. Here is how the
            people who know you answered the same words about you.
          </p>
        )}

        <div className="mt-12">
          {unlocked ? (
            <ComparisonReport
              self={score(row.words)}
              others={others.scores}
              perObserver={others.perObserver}
            />
          ) : (
            <LockedState count={others.observerCount} />
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Shown before the report unlocks: a clear count of responses so far and how
 * many are still needed, with a route back to the result page where the Subject
 * copies their observer link to invite more people.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div className="rounded-[2px] border border-hair p-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Locked
      </p>
      <h2 className="mt-2 font-serif text-[24px] font-semibold leading-snug">
        {count === 0
          ? "No one has weighed in yet"
          : `${count} of ${MIN_OBSERVERS} people have weighed in`}
      </h2>
      <p className="mt-3 max-w-[480px] text-[15px] text-muted">
        Your report opens once at least {MIN_OBSERVERS} people respond — enough
        for the &ldquo;others&rdquo; view to be meaningful while keeping each
        person anonymous. {remaining} more{" "}
        {remaining === 1 ? "response" : "responses"} to go.
      </p>

      {/* Progress pips toward the unlock threshold. */}
      <div className="mt-6 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={
              "h-2.5 flex-1 rounded-full " +
              (i < count ? "bg-gold" : "bg-hair")
            }
          />
        ))}
      </div>

      <Link
        href="/assessment/result"
        className="mt-8 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        Invite more people
      </Link>
    </div>
  );
}
