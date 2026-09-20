import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  isReportUnlocked,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's own 360 comparison report (issue #9, ADR-0003): their Self
 * Assessment profile beside the equal-weight aggregate of how anonymous
 * Observers read them. Login-gated — an unauthenticated visitor routes through
 * sign-in, and a signed-in user who hasn't taken the assessment is sent to start
 * it (there's no self profile to compare against yet).
 *
 * The report unlocks only once at least {@link OBSERVER_UNLOCK_THRESHOLD}
 * Observers have responded, so the "others" view is meaningful and no single
 * Observer can be picked out of it. Below the threshold the page shows a locked
 * state with progress and the shareable link to gather more responses.
 *
 * Scoring and aggregation run here on the server (the word→tribe mapping is
 * `server-only`, ADR-0009); only the plain numeric profiles cross into the
 * presentational `ComparisonReport`.
 */
export default async function AssessmentReportPage() {
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
          <ComparisonReport
            observerCount={aggregate.observerCount}
            comparison={compareProfiles(score(row.words), aggregate.others)}
            perObserver={aggregate.perObserver}
          />
        ) : (
          <LockedReport
            observerCount={aggregate.observerCount}
            shareUrl={`${await observerLinkBase()}/a/${row.shareToken}`}
          />
        )}
      </div>
    </main>
  );
}

/**
 * The pre-unlock state: how many Observers have responded so far, how many are
 * needed, and the shareable link to gather more. Kept deliberately encouraging
 * rather than clinical — the report is a reward for inviting a few people.
 */
function LockedReport({
  observerCount,
  shareUrl,
}: {
  observerCount: number;
  shareUrl: string;
}) {
  const remaining = OBSERVER_UNLOCK_THRESHOLD - observerCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.04]">
        Almost there
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted">
        Your comparison report unlocks once{" "}
        <span className="text-ink">
          {OBSERVER_UNLOCK_THRESHOLD} people
        </span>{" "}
        have anonymously described you — enough that the &ldquo;others&rdquo;
        view is meaningful and no single response can be singled out.
      </p>

      <div className="mt-10 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[20px]">
            <span className="text-gold">{observerCount}</span> /{" "}
            {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${(observerCount / OBSERVER_UNLOCK_THRESHOLD) * 100}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response to go."
            : `${remaining} more responses to go.`}
        </p>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to a few people who know you well. Each one anonymously
          picks the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}

/**
 * The origin the shareable observer link is built against — the same rule the
 * result page uses. Prefers the configured `AUTH_URL` (trusted, set per
 * deployment) so a forwarded `Host` header can't skew the copied link; falls
 * back to the request host, then to a relative path.
 */
async function observerLinkBase(): Promise<string> {
  const configured = process.env.AUTH_URL?.replace(/\/+$/, "");
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) return "";

  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
