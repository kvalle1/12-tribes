import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerLinkForToken } from "@/lib/observer/share-url";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * owned by the Subject: it compares the signed-in Subject's own saved result
 * against the equal-weight aggregate of their anonymous observers.
 *
 * The report unlocks only once at least `MIN_OBSERVERS` (3) observers have
 * responded — below that the aggregate isn't meaningful and individual observers
 * wouldn't stay anonymous, so a clear locked state is shown with the share link
 * to gather more responses instead.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  // Both queries key off the same user id and don't depend on each other, so
  // issue them concurrently rather than blocking on the result row first.
  const [row, responses] = await Promise.all([
    getCurrentResult(session.user.id),
    getObserverResponses(session.user.id),
  ]);
  if (!row) redirect("/assessment");

  const aggregate = aggregateObservers(responses);
  const unlocked = hasEnoughObservers(aggregate.observerCount);

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
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
            aggregate={aggregate}
          />
        ) : (
          // Only the locked state needs the share link, so build it here rather
          // than on every unlocked render.
          <LockedReport
            observerCount={aggregate.observerCount}
            shareUrl={await observerLinkForToken(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before the report unlocks. States how many more
 * observers are needed and surfaces the share link so the Subject can invite
 * them, rather than revealing a one- or two-observer aggregate that would be
 * noisy and compromise anonymity.
 */
function LockedReport({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        A 360 read · locked
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        How others see you
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        answered. That keeps the &ldquo;others&rdquo; view meaningful and every
        response anonymous.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair bg-white/40 p-6">
        <div className="text-[12px] uppercase tracking-[0.16em] text-faint">
          Responses so far
        </div>
        <div className="mt-2 font-serif text-[40px] font-semibold leading-none">
          {observerCount}{" "}
          <span className="text-[20px] text-muted">/ {MIN_OBSERVERS}</span>
        </div>
        <p className="mt-3 text-[15px] text-ink">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
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
