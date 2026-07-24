import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWords } from "@/lib/observer/repository";
import {
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated: an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there is no Subject to compare against yet).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS} Observers have
 * responded — below the floor the "others" average isn't meaningful and an
 * individual Observer could be singled out, so we show a clear locked state that
 * points the Subject back to their result to share the observer link. At or above
 * the floor, the aggregated comparison renders.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWords = await getObserverWords(session.user.id);
  const unlocked = isComparisonUnlocked(observerWords.length);

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
          <ComparisonReport selfWords={row.words} observerWords={observerWords} />
        ) : (
          <LockedState count={observerWords.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how many of the required {@link MIN_OBSERVERS} responses
 * are in, and a route back to the result page where the shareable observer link
 * lives. Deliberately shows no scores — nothing about the "others" view leaks
 * before the anonymity floor is met.
 */
function LockedState({ count }: { count: number }) {
  const remaining = Math.max(MIN_OBSERVERS - count, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        A few more reads to go
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison opens once at least {MIN_OBSERVERS} people have
        anonymously described you. That keeps the &ldquo;others&rdquo; view
        meaningful and every individual response private.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[44px] font-semibold leading-none text-gold">
            {count}
          </span>
          <span className="text-[14px] text-muted">
            of {MIN_OBSERVERS} responses so far
          </span>
        </div>
        <div className="mt-5 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your comparison unlocks."
            : `${remaining} more responses and your comparison unlocks.`}
        </p>
      </div>

      <Link
        href="/assessment/result"
        className="mt-10 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        Get your share link
      </Link>
    </div>
  );
}
