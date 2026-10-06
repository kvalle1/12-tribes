import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import {
  aggregateObservers,
  isComparisonUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated to
 * the Subject: an unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least `MIN_OBSERVERS_FOR_REPORT` (3) anonymous
 * Observers have responded, so the "others" view is meaningful and no single
 * Observer can be singled out. Below that threshold the page shows a clear
 * locked state with the running count and the invite link.
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
  const profile = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isComparisonUnlocked(profile.observerCount) ? (
          <ComparisonReport words={row.words} profile={profile} />
        ) : (
          <LockedState
            observerCount={profile.observerCount}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

function LockedState({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 report — locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05]">
        A few more responses to go
      </h1>
      <p className="mt-5 max-w-[560px] text-[16px] leading-relaxed text-muted">
        Your comparison report unlocks once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have responded — enough that the
        &ldquo;others&rdquo; view is meaningful and no single person can be
        singled out.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-10">
        <div className="flex items-center gap-2">
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < observerCount ? "bg-gold" : "bg-hair/60"
              }`}
              aria-hidden
            />
          ))}
        </div>
        <p className="mt-3 text-[14px] text-muted">
          <strong className="font-semibold text-ink">{observerCount}</strong> of{" "}
          {MIN_OBSERVERS_FOR_REPORT} responses in
          {remaining > 0 && (
            <>
              {" "}
              — {remaining} more to unlock.
            </>
          )}
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
