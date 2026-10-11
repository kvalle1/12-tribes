import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isObserverReportUnlocked,
  OBSERVER_REPORT_MINIMUM,
} from "@/lib/assessment/aggregateObservers";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/link";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): a signed-in Subject sees their
 * own Strength Profile beside the equal-weight aggregate of how their Observers
 * read them. Login-gated like the rest of the assessment; a Subject with no
 * saved result is sent to take it first (they need a result to mint the observer
 * link).
 *
 * The report unlocks only once at least `OBSERVER_REPORT_MINIMUM` Observers have
 * responded — before then the "others" view would be too thin to be meaningful
 * and an individual Observer too easy to single out, so a clear locked state is
 * shown instead, with the share link to gather more responses.
 *
 * All scoring and aggregation runs here on the server; only the already-computed
 * scores (plain numbers, no word→tribe mapping) reach the client component.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/360")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponsesForSubject(session.user.id);
  const unlocked = isObserverReportUnlocked(responses.length);
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

        {unlocked ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedReport
            count={responses.length}
            shareUrl={await observerShareUrl(row.shareToken)}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state shown until at least `OBSERVER_REPORT_MINIMUM` Observers have
 * responded. Communicates progress toward the threshold and surfaces the share
 * link so the Subject can gather the responses they still need.
 */
function LockedReport({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = OBSERVER_REPORT_MINIMUM - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        A few more responses to go
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison report unlocks once at least {OBSERVER_REPORT_MINIMUM}{" "}
        people have described you. Keeping it to three or more means the
        &ldquo;others&rdquo; view is meaningful and every observer stays
        anonymous — no one&rsquo;s answers can be singled out.
      </p>

      <div className="mt-10 flex items-center gap-4">
        <span className="font-serif text-[40px] leading-none text-gold">
          {count}
        </span>
        <span className="text-[14px] text-muted">
          of {OBSERVER_REPORT_MINIMUM} responses so far
          <br />
          {remaining === 1
            ? "1 more and your report unlocks."
            : `${remaining} more and your report unlocks.`}
        </span>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-hair/50">
        <div
          className="h-full rounded-full bg-gold transition-[width]"
          style={{
            width: `${Math.min(count / OBSERVER_REPORT_MINIMUM, 1) * 100}%`,
          }}
          role="img"
          aria-label={`${count} of ${OBSERVER_REPORT_MINIMUM} observer responses received`}
        />
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
