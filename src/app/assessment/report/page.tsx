import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordsForSubject } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import { aggregateObservers } from "@/lib/assessment/aggregateObservers";
import { MIN_OBSERVERS, hasEnoughObservers } from "@/lib/assessment/constants";
import { observerShareUrl } from "@/lib/observer/share-link";
import { ObserverComparison } from "@/components/observer-comparison";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): how the Subject sees
 * themselves beside the equal-weight "others" profile aggregated from anonymous
 * Observer responses. Login-gated — a Subject only ever sees their own report.
 *
 * The report unlocks only once at least `MIN_OBSERVERS` Observers have responded;
 * before then it renders a locked state that shows progress and re-surfaces the
 * invite link, so the "others" average stays meaningful and no individual
 * Observer can be singled out. Scoring runs on the server (the word→tribe mapping
 * never reaches the client); the client receives only computed `TribeScore[]`.
 */
export default async function ObserverReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverWordsForSubject(session.user.id);
  const unlocked = hasEnoughObservers(responses.length);
  const shareUrl = await observerShareUrl(row.shareToken);

  const aggregate = unlocked ? aggregateObservers(responses) : null;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Your 360 report
        </p>
        <h1 className="mt-2 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
          How others see you
        </h1>

        {aggregate ? (
          <div className="mt-12">
            <p className="max-w-[520px] text-[15px] text-muted">
              {aggregate.count} people described you anonymously. Here is their
              read beside your own — the gap between the two is where the most
              useful insight lives.
            </p>
            <div className="mt-10">
              <ObserverComparison
                self={score(row.words)}
                others={aggregate.average}
                perObserver={aggregate.perObserver}
              />
            </div>
          </div>
        ) : (
          <LockedState responsesSoFar={responses.length} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

function LockedState({
  responsesSoFar,
  shareUrl,
}: {
  responsesSoFar: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS - responsesSoFar;

  return (
    <div className="mt-12">
      <div className="rounded-[2px] border border-hair bg-white/60 p-8">
        <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
          Locked
        </div>
        <p className="mt-3 max-w-[520px] text-[16px] leading-relaxed text-ink">
          Your report unlocks once at least {MIN_OBSERVERS} people have
          responded. Waiting for a few reads keeps the &ldquo;others&rdquo;
          picture meaningful and keeps each person&rsquo;s answers anonymous.
        </p>

        {/* Progress toward the unlock threshold. */}
        <div
          className="mt-6 flex items-center gap-2"
          role="img"
          aria-label={`${responsesSoFar} of ${MIN_OBSERVERS} responses received`}
        >
          {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
            <span
              key={i}
              className={
                "h-2.5 flex-1 rounded-full " +
                (i < responsesSoFar ? "bg-gold" : "bg-hair/60")
              }
            />
          ))}
        </div>
        <p className="mt-3 text-[13px] tracking-[0.04em] text-muted">
          {responsesSoFar === 0
            ? "No responses yet."
            : `${responsesSoFar} of ${MIN_OBSERVERS} responses in`}
          {remaining > 0 && (
            <>
              {" "}
              — {remaining} more to go.
            </>
          )}
        </p>
      </div>

      <section className="mt-10">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more people
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
