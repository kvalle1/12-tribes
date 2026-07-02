import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ObserverComparison } from "@/components/observer-comparison";

/**
 * The 360 comparison report (issue #9): how the Subject sees themselves vs how
 * their anonymous Observers do. Login-gated to the Subject; a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report stays locked until at least three Observers have responded
 * (ADR-0003) — enough to make the equal-weight average meaningful and to keep no
 * single Observer identifiable. All scoring (self and the Observer aggregate)
 * happens here on the server; only slug/name/score rows cross to the client
 * view (ADR-0009).
 */
export default async function ObserverReportPage() {
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

        {isReportUnlocked(aggregate.observerCount) ? (
          <ObserverComparison
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedReport count={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: shown until three Observers have responded. It reveals
 * no scores — an aggregate over one or two Observers could effectively expose an
 * individual — and instead nudges the Subject back to their result to share the
 * observer link with more people.
 */
function LockedReport({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 report
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        The comparison unlocks once at least {MIN_OBSERVERS_FOR_REPORT} people
        have described you. That keeps the &ldquo;others&rdquo; view meaningful
        and every Observer anonymous — so no single response can be singled out.
      </p>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 w-10 rounded-full ${
                i < count ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="text-[14px] text-muted">
          {count} of {MIN_OBSERVERS_FOR_REPORT}{" "}
          {count === 1 ? "response" : "responses"} in
        </p>
      </div>

      <p className="mt-6 max-w-[560px] text-[15px] text-ink">
        {remaining === 1
          ? "Just one more response and your report unlocks."
          : `${remaining} more responses and your report unlocks.`}
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Share your observer link
        </Link>
      </div>
    </div>
  );
}
