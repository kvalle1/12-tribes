import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  aggregateObservers,
  isReportUnlocked,
  MIN_OBSERVERS_FOR_REPORT,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight average of their anonymous observers. Login-gated —
 * an unauthenticated visitor is routed through sign-in, and a signed-in user
 * who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least three observers have responded; before
 * then the page shows a clear locked state explaining what's left. All scoring
 * and aggregation run here on the server (the word→tribe mapping never reaches
 * the client, ADR-0009); the view receives only plain score arrays.
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const aggregation = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {isReportUnlocked(aggregation.observerCount) ? (
          <ComparisonReport
            self={score(row.words)}
            others={aggregation.others}
            perObserver={aggregation.perObserver}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        ) : (
          <LockedState observerCount={aggregation.observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least `MIN_OBSERVERS_FOR_REPORT` observers have responded. The
 * average is too thin to be meaningful below that, and holding the report closed
 * also protects individual observers' anonymity, so we say plainly how many more
 * reads are needed rather than showing a half-formed comparison.
 */
function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - observerCount;
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-5 max-w-[540px] text-[16px] text-muted">
        Your comparison report opens once at least {MIN_OBSERVERS_FOR_REPORT}{" "}
        people have described you. So far{" "}
        <span className="text-ink">
          {observerCount === 0
            ? "no one has responded"
            : observerCount === 1
              ? "1 person has responded"
              : `${observerCount} people have responded`}
        </span>
        {remaining > 0 && (
          <>
            {" "}— {remaining} more {remaining === 1 ? "read" : "reads"} to go.
          </>
        )}
      </p>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Keeping it closed until then makes the average meaningful and protects
        each observer&rsquo;s anonymity.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <Link
          href="/assessment/result"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Get your share link
        </Link>
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          ← Back to your result
        </Link>
      </div>
    </div>
  );
}
