import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/link";
import {
  isComparisonUnlocked,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the Self Assessment is sent to start it (there is no "self" to
 * compare against yet).
 *
 * The report unlocks only once at least three Observers have responded — below
 * that the "others" average would be thin and individual Observers too easy to
 * single out (ADR-0003). Until then the page shows a clear locked state with
 * progress toward the threshold and the share link to invite more Observers.
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
  const unlocked = isComparisonUnlocked(responses.length);

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
            observerResponses={responses}
          />
        ) : (
          <LockedState
            responseCount={responses.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until the ≥3-Observer threshold is met: how many have responded, how
 * many are still needed, and the share link to invite more.
 */
function LockedState({
  responseCount,
  shareUrl,
}: {
  responseCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read · locked
      </p>
      <h1 className="mt-2 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        A few more voices needed
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison unlocks once{" "}
        <span className="text-ink">at least {MIN_OBSERVERS_TO_UNLOCK}</span>{" "}
        people have anonymously described you. That keeps the &ldquo;others&rdquo;
        view meaningful and each individual observer unidentifiable.
      </p>

      {/* Progress toward the threshold. */}
      <div className="mt-8">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[18px]">
            {responseCount} of {MIN_OBSERVERS_TO_UNLOCK}{" "}
            {responseCount === 1 ? "response" : "responses"}
          </span>
          <span className="text-[12px] uppercase tracking-[0.14em] text-faint">
            {remaining} more to unlock
          </span>
        </div>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${responseCount} of ${MIN_OBSERVERS_TO_UNLOCK} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(responseCount / MIN_OBSERVERS_TO_UNLOCK, 1) * 100}%`,
            }}
          />
        </div>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to people who know you well. Each one anonymously picks
          the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
