import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { MIN_OBSERVERS_TO_UNLOCK } from "@/lib/assessment/aggregateObservers";
import { ComparisonView } from "@/components/comparison-view";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it (they have no profile to
 * compare against, and no observer link to have shared).
 *
 * The report unlocks only once at least `MIN_OBSERVERS_TO_UNLOCK` Observers have
 * responded — below that the "others" view isn't statistically meaningful and a
 * lone Observer could be de-anonymized, so a clear locked state is shown instead.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = responses.length >= MIN_OBSERVERS_TO_UNLOCK;

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
          <ComparisonView subjectWords={row.words} responses={responses} />
        ) : (
          <LockedState count={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS_TO_UNLOCK` Observers have responded. Reports
 * concrete progress (how many of the needed responses are in) so the Subject
 * knows how close the report is to unlocking, and points them back to the share
 * link to gather more.
 */
function LockedState({ count }: { count: number }) {
  const remaining = MIN_OBSERVERS_TO_UNLOCK - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] leading-relaxed text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS_TO_UNLOCK}{" "}
        people have described you. That keeps the &ldquo;others&rdquo; view
        meaningful and each response anonymous.
      </p>

      <div className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Responses so far
        </p>
        <div className="mt-4 flex items-center gap-4">
          <span className="font-serif text-[40px] leading-none text-ink">
            {count}
          </span>
          <span className="text-[14px] text-muted">
            of {MIN_OBSERVERS_TO_UNLOCK} needed
          </span>
        </div>
        <div className="mt-5 flex gap-2" aria-hidden>
          {Array.from({ length: MIN_OBSERVERS_TO_UNLOCK }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair/60"
              }`}
            />
          ))}
        </div>
        <p className="mt-5 text-[14px] text-muted">
          {remaining === 1
            ? "One more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link to gather more
        </Link>
      </div>
    </div>
  );
}
