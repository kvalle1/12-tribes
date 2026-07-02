import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  MIN_OBSERVERS_TO_UNLOCK,
} from "@/lib/observer/aggregate";
import { observerLink } from "@/lib/observer/link";
import { score } from "@/lib/assessment/score";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated: an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it (there is nothing to compare against yet).
 *
 * The report stays **locked** until at least three Observers have responded, so
 * the "others" view is meaningful and individual Observers stay anonymous. While
 * locked it shows progress and the share link so the Subject can gather the
 * remaining responses; once unlocked it renders the self-vs-others comparison and
 * the anonymous per-observer drill-down via {@link ComparisonReport}.
 *
 * All scoring runs here on the server (the `server-only` scoring core and the
 * word→tribe mapping never reach the client); the presentational report receives
 * only the computed profiles.
 */
export default async function ReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const aggregate = aggregateObservers(
    await getObserverResponses(session.user.id),
  );

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {aggregate.unlocked ? (
          <ComparisonReport self={score(row.words)} aggregate={aggregate} />
        ) : (
          <LockedReport
            observerCount={aggregate.observerCount}
            shareUrl={await observerLink(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before enough Observers have responded. Communicates
 * how many more are needed and puts the share link right there so the Subject can
 * close the gap.
 */
function LockedReport({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS_TO_UNLOCK}{" "}
        people have described you. That keeps the &ldquo;others&rdquo; view
        meaningful and every observer anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair bg-white p-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[40px] font-semibold leading-none text-gold">
            {observerCount}
          </span>
          <span className="font-serif text-[20px] text-muted">
            / {MIN_OBSERVERS_TO_UNLOCK} responses
          </span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50">
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(
                (observerCount / MIN_OBSERVERS_TO_UNLOCK) * 100,
                100,
              )}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[15px] text-ink">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses to go.`}
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

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
      </div>
    </div>
  );
}
