import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/link";
import {
  aggregateObservers,
  hasEnoughObservers,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregate-observers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * scoped to the signed-in Subject's own responses.
 *
 * The report unlocks only once at least three Observers have responded, so the
 * aggregate stays meaningful and no single Observer can be identified (PRD story
 * 23). Below that threshold the page shows a clear locked state with progress
 * and the share link to gather more responses. Above it, the equal-weight
 * "others" profile is rendered beside the Subject's own by `ComparisonReport`.
 *
 * Server component: it reads the session and the (server-only) observer
 * responses and runs the server-only scoring core; nothing about the scoring or
 * the word→tribe mapping reaches the client (ADR-0009).
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregate = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {hasEnoughObservers(aggregate.observerCount) ? (
          <ComparisonReport selfWords={row.words} aggregate={aggregate} />
        ) : (
          <LockedReport
            observerCount={aggregate.observerCount}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown before the report unlocks: how many responses are in,
 * how many more are needed, and the share link to gather them. Individual
 * observer reads stay hidden here so no one is identifiable below the threshold.
 */
function LockedReport({
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
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not enough responses yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        {observerCount === 0
          ? "No one has responded yet."
          : `${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} ${
              observerCount === 1 ? "person has" : "people have"
            } responded.`}{" "}
        Your comparison report unlocks once at least {MIN_OBSERVERS_FOR_REPORT}{" "}
        people have answered — that keeps the &ldquo;others&rdquo; view
        meaningful and every observer anonymous.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div
        className="mt-8 flex gap-2"
        role="img"
        aria-label={`${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} responses received`}
      >
        {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < observerCount ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite {remaining} more {remaining === 1 ? "person" : "people"}
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
