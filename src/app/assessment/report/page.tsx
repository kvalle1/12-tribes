import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverWordLists } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor routes through sign-in, and a signed-in user who
 * hasn't taken the Self Assessment is sent to start it (there is no "self" to
 * compare against yet).
 *
 * The report unlocks only once at least three Observers have responded — below
 * that it renders a clear locked state, both because a tiny pool is noisy and
 * because it would erode individual Observer anonymity. All scoring happens here
 * on the server; the report component receives only computed `TribeScore` data.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverWordLists(session.user.id);
  const aggregate = aggregateObservers(observerWordLists);

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
          <ComparisonReport
            self={score(row.words)}
            others={aggregate.others}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedState count={aggregate.observerCount} />
        )}
      </div>
    </main>
  );
}

/** The pre-unlock state: how many of the required responses have arrived. */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison — locked
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Not enough responses yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison report unlocks once at least{" "}
        {MIN_OBSERVERS_FOR_REPORT} people have described you. This keeps the
        &ldquo;others&rdquo; read meaningful and keeps each observer anonymous.
      </p>

      <div className="mt-9 flex items-center gap-4">
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }).map((_, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor: i < count ? "var(--gold)" : "var(--hair)",
              }}
            />
          ))}
        </div>
        <span className="text-[14px] text-muted">
          {count} of {MIN_OBSERVERS_FOR_REPORT} responses in
        </span>
      </div>

      <p className="mt-9 text-[16px] leading-relaxed text-ink">
        {remaining === 1
          ? "Just one more response and your report opens."
          : `Share your observer link with ${remaining} more people to open it.`}
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
