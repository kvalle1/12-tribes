import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { isReportUnlocked, MIN_OBSERVERS } from "@/lib/observer/constants";
import { observerShareUrl } from "@/lib/observer/link";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's 360 comparison report (issue #9). Login-gated like the result
 * page: an unauthenticated visitor is routed through sign-in, and a signed-in
 * user who hasn't taken the assessment is sent to start it (there's nothing to
 * compare against yet).
 *
 * The report stays locked until at least three Observers have responded
 * (ADR-0003) — below that the equal-weight average isn't meaningful and an
 * individual Observer could be deanonymized. The locked state shows progress and
 * re-offers the share link so the Subject can invite the observers still needed.
 */
export default async function ObserverReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/observers")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerResponses = await getObserverResponses(session.user.id);
  const unlocked = isReportUnlocked(observerResponses.length);

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
          <LockedState
            observerCount={observerResponses.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown before the ≥3-observer threshold is met: a clear locked state with
 * progress and the share link to gather the remaining observers.
 */
function LockedState({
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
        Your 360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(30px,5vw,44px)] font-semibold leading-[1.08]">
        Locked until {MIN_OBSERVERS} observers respond
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        {observerCount === 0 ? (
          <>
            No observers have responded yet. Once {MIN_OBSERVERS} people have
            described you, you&rsquo;ll see how their read compares with your
            own — kept locked until then so the average is meaningful and every
            observer stays anonymous.
          </>
        ) : (
          <>
            {observerCount} of {MIN_OBSERVERS} observers have responded. {remaining}{" "}
            more {remaining === 1 ? "response unlocks" : "responses unlock"} your
            comparison — the threshold keeps the average meaningful and every
            observer anonymous.
          </>
        )}
      </p>

      {/* Progress pips toward the unlock threshold. */}
      <div
        className="mt-8 flex gap-2"
        role="img"
        aria-label={`${observerCount} of ${MIN_OBSERVERS} observers responded`}
      >
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={
              "h-2.5 w-2.5 rounded-full " +
              (i < observerCount ? "bg-gold" : "bg-hair")
            }
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite observers
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
