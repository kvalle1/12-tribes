import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";
import { ComparisonView } from "@/components/comparison-view";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated
 * like the result page: an unauthenticated visitor routes through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS} observers have
 * responded (equal-weight aggregation is thin — and less anonymous — below that);
 * before then a clear locked state shows how many responses are still needed.
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
  const count = responses.length;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isComparisonUnlocked(count) ? (
          <ComparisonView
            selfWords={row.words}
            aggregate={aggregateObservers(responses)}
          />
        ) : (
          <LockedState count={count} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before the {@link MIN_OBSERVERS}-observer floor is met.
 * It reports progress toward the unlock so the Subject knows how many more people
 * need to respond, without revealing anything about who has answered.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS - count;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people have
        described you. So far{" "}
        <span className="text-ink">
          {count} {count === 1 ? "person has" : "people have"}
        </span>{" "}
        responded — {remaining} more to go. Keeping the floor at {MIN_OBSERVERS}
        keeps each response anonymous in the average.
      </p>

      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < count ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>

      <div className="mt-12 border-t border-hair pt-8">
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
