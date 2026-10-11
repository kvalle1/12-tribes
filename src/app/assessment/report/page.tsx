import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWords } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/link";
import { score } from "@/lib/assessment/score";
import {
  averageProfiles,
  isReportUnlocked,
  MIN_OBSERVERS,
} from "@/lib/assessment/aggregate";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile set
 * beside the equal-weight "others" profile, unlocking only once at least
 * `MIN_OBSERVERS` anonymous observers have responded.
 *
 * Login-gated like the result page — an unauthenticated visitor is routed
 * through sign-in, and a signed-in user who hasn't taken the assessment is sent
 * to start it. All scoring (self, the equal-weight aggregate, and each
 * observer's individual profile) runs here on the server; only computed scores
 * reach the client (ADR-0009).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWords = await getObserverWords(session.user.id);
  const unlocked = isReportUnlocked(observerWords.length);

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
          (() => {
            // Score each Observer once, then reuse those profiles for both the
            // equal-weight aggregate and the per-observer drill-down so the two
            // can never drift (and score() isn't run twice per Observer).
            const perObserver = observerWords.map((words) => score(words));
            return (
              <ComparisonReport
                self={score(row.words)}
                others={averageProfiles(perObserver)}
                perObserver={perObserver}
              />
            );
          })()
        ) : (
          <LockedState
            observerCount={observerWords.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS` observers respond. Explains the gate,
 * shows progress toward it, and surfaces the same share link so the Subject can
 * invite the observers still needed to unlock the report (ADR-0003).
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
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS} people have
        anonymously described you. That keeps the &ldquo;others&rdquo; view
        meaningful and no single observer identifiable.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Observers so far
          </span>
          <span className="font-serif text-[22px]">
            {observerCount}{" "}
            <span className="text-muted">/ {MIN_OBSERVERS}</span>
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${MIN_OBSERVERS} observers have responded`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min((observerCount / MIN_OBSERVERS) * 100, 100)}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-ink">
          {remaining === 1
            ? "Just one more response to unlock."
            : `${remaining} more responses to unlock.`}
        </p>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Share this link with people who know you well. Each one anonymously
          picks the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}
