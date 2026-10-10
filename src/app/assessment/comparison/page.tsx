import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerLinkBase } from "@/lib/observer/link";
import {
  hasEnoughObservers,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least `OBSERVER_UNLOCK_THRESHOLD` observers
 * have responded — until then this page renders a clear locked state with the
 * observer link so the Subject can invite the people still needed. Once
 * unlocked, `ComparisonReport` renders the self-vs-others comparison.
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

  const observerResponses = await getObserverResponses(session.user.id);
  const unlocked = hasEnoughObservers(observerResponses.length);
  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

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
            observerResponses={observerResponses}
          />
        ) : (
          <LockedState count={observerResponses.length} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before enough observers have responded. States how
 * many have responded and how many more are needed, and surfaces the observer
 * link so the Subject can gather the rest — anonymity and the average both rely
 * on reaching the threshold before any "others" read is shown.
 */
function LockedState({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
        {count === 0 ? (
          <>No one has responded yet.</>
        ) : (
          <>
            {count} of {OBSERVER_UNLOCK_THRESHOLD}{" "}
            {count === 1 ? "person has" : "people have"} responded.
          </>
        )}{" "}
        The comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have answered — enough to make the &ldquo;others&rdquo; read meaningful
        and to keep every response anonymous.{" "}
        {remaining > 0 && (
          <>
            {remaining} more {remaining === 1 ? "response" : "responses"} to go.
          </>
        )}
      </p>

      <div
        className="mt-8 flex items-center gap-3"
        role="img"
        aria-label={`${count} of ${OBSERVER_UNLOCK_THRESHOLD} observers responded`}
      >
        {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, index) => (
          <span
            key={index}
            className={`h-2.5 flex-1 rounded-full ${
              index < count ? "bg-gold" : "bg-hair/60"
            }`}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite your observers
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
