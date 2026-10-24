import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import {
  isComparisonUnlocked,
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * against the equal-weight "others" profile built from their anonymous Observer
 * responses.
 *
 * Login-gated like the result page — an unauthenticated visitor is routed
 * through sign-in, and a signed-in user with no saved result is sent to take the
 * assessment first. The report only unlocks once at least {@link MIN_OBSERVERS}
 * Observers have responded (both so the average is meaningful and so no single
 * Observer can be singled out); before then the page shows a clear locked state
 * with how many responses are still needed.
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

  const observerWordLists = await getObserverResponsesForSubject(
    session.user.id,
  );

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        {isComparisonUnlocked(observerWordLists.length) ? (
          <ComparisonReport
            selfWords={row.words}
            observerWordLists={observerWordLists}
          />
        ) : (
          <LockedState responded={observerWordLists.length} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until the report unlocks. Says plainly how many Observers have answered
 * and how many more are needed, and points back to the result page where the
 * shareable observer link lives, so the Subject can invite the rest.
 */
function LockedState({ responded }: { responded: number }) {
  const remaining = MIN_OBSERVERS - responded;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        360 comparison · locked
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,6vw,52px)] font-semibold leading-[1.04]">
        A few more reads to go
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people have
        answered. It stays locked until then so the &ldquo;others&rdquo; picture
        is steady and no single response can be singled out.
      </p>

      <div className="mt-9 flex items-center gap-4">
        <div className="font-serif text-[52px] font-semibold leading-none text-gold">
          {responded}
          <span className="text-muted">/{MIN_OBSERVERS}</span>
        </div>
        <p className="text-[14px] text-muted">
          {responded === 0
            ? "No responses yet."
            : responded === 1
              ? "One response in."
              : `${responded} responses in.`}{" "}
          {remaining === 1
            ? "One more unlocks it."
            : `${remaining} more unlock it.`}
        </p>
      </div>

      <div className="mt-10 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Share your observer link to invite more →
        </Link>
      </div>
    </div>
  );
}
