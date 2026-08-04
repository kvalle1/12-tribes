import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isObserverReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import {
  ComparisonReport,
  ObserverReportLocked,
} from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003) — the Subject's own profile
 * beside the equal-weight "others" profile. Login-gated to the Subject's own
 * account; a signed-in user who hasn't taken the assessment is sent to start it.
 *
 * Everything is computed server-side: observer responses are scored and averaged
 * here, and only plain scores reach the view, so the word→tribe mapping never
 * crosses the trust boundary (ADR-0009). The report stays locked until at least
 * OBSERVER_UNLOCK_THRESHOLD observers have responded.
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
  const aggregate = aggregateObservers(responses);
  const unlocked = isObserverReportUnlocked(aggregate.observerCount);

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
            rows={compareProfiles(score(row.words), aggregate.scores)}
            perObserver={aggregate.perObserver}
            observerCount={aggregate.observerCount}
          />
        ) : (
          <ObserverReportLocked
            observerCount={aggregate.observerCount}
            threshold={OBSERVER_UNLOCK_THRESHOLD}
          />
        )}
      </div>
    </main>
  );
}
