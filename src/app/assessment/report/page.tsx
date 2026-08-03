import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's Self profile
 * beside the equal-weight "others" profile from their anonymous Observers.
 *
 * Login-gated exactly like the result page — an unauthenticated visitor is routed
 * through sign-in, and a signed-in user who hasn't taken the assessment is sent
 * to start it (there's no self profile to compare against yet). The report
 * unlocks only once at least three Observers have responded (`isReportUnlocked`);
 * before then it shows a clear locked state with how many more are needed, so the
 * average stays meaningful and no single Observer is identifiable.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isReportUnlocked(responses.length) ? (
          <ComparisonReport
            selfWords={row.words}
            observerResponses={responses}
          />
        ) : (
          <LockedReport responded={responses.length} />
        )}
      </div>
    </main>
  );
}

/**
 * The locked state, shown until at least `OBSERVER_UNLOCK_THRESHOLD` Observers
 * respond. States plainly how many have answered and how many more are needed,
 * and points back to the result page where the shareable link lives.
 */
function LockedReport({ responded }: { responded: number }) {
  const remaining = Math.max(OBSERVER_UNLOCK_THRESHOLD - responded, 0);

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.04]">
        Still gathering
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your comparison unlocks once at least {OBSERVER_UNLOCK_THRESHOLD} people
        have described you — enough to make the &ldquo;others&rdquo; read
        meaningful and to keep every observer anonymous.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-10">
        <div
          className="flex items-center gap-2"
          role="img"
          aria-label={`${responded} of ${OBSERVER_UNLOCK_THRESHOLD} observers responded`}
        >
          {Array.from({ length: OBSERVER_UNLOCK_THRESHOLD }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 flex-1 rounded-full ${
                i < responded ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-[13px] text-faint">
          {responded} of {OBSERVER_UNLOCK_THRESHOLD} responded
          {remaining > 0 && ` · ${remaining} more to go`}
        </p>
      </div>

      <div className="mt-12 border-t border-hair pt-8">
        <p className="max-w-[520px] text-[15px] text-muted">
          Share your observer link with a few more people who know you well, then
          check back here.
        </p>
        <Link
          href="/assessment/result"
          className="mt-6 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your observer link
        </Link>
      </div>
    </div>
  );
}
