import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { listObserverResponses } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  aggregateObservers,
  compareProfiles,
  OBSERVER_UNLOCK_THRESHOLD,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The self-vs-others 360 comparison report (issue #9, ADR-0003). Login-gated
 * like the result page: an unauthenticated visitor is routed through sign-in,
 * and a signed-in user who hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least three Observers have responded. Below
 * that it shows a locked state with progress and the share link; at or above it
 * the equal-weight "others" profile is computed server-side and rendered by
 * `ComparisonReport`. All scoring stays on the server (ADR-0009); the client only
 * ever receives normalized scores.
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

  const responses = await listObserverResponses(session.user.id);
  const observerCount = responses.length;
  const unlocked = observerCount >= OBSERVER_UNLOCK_THRESHOLD;

  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {unlocked ? (
          <UnlockedReport words={row.words} responses={responses} />
        ) : (
          <LockedState observerCount={observerCount} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/** Compose and render the report once enough Observers have responded. */
function UnlockedReport({
  words,
  responses,
}: {
  words: string[];
  responses: { words: string[] }[];
}) {
  const self = score(words);
  const { average, perObserver, observerCount } = aggregateObservers(responses);
  const comparison = compareProfiles(self, average);

  return (
    <ComparisonReport
      comparison={comparison}
      perObserver={perObserver}
      observerCount={observerCount}
    />
  );
}

/**
 * The pre-unlock state: how many of the three needed responses are in, and the
 * share link to gather more. Kept deliberately clear so the Subject knows the
 * report exists and how to reach it (ADR-0003 unlock-at-3).
 */
function LockedState({
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
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison report opens once at least{" "}
        {OBSERVER_UNLOCK_THRESHOLD} people have shared how they see you. That
        keeps the combined read meaningful and every observer anonymous.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-8">
        <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-faint">
          <span>Responses so far</span>
          <span className="tabular-nums">
            {observerCount} / {OBSERVER_UNLOCK_THRESHOLD}
          </span>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${observerCount} of ${OBSERVER_UNLOCK_THRESHOLD} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min(
                (observerCount / OBSERVER_UNLOCK_THRESHOLD) * 100,
                100,
              )}%`,
            }}
          />
        </div>
        <p className="mt-3 text-[14px] text-muted">
          {remaining} more{" "}
          {remaining === 1 ? "response" : "responses"} to unlock your report.
        </p>
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Gather more reads
        </p>
        <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
          Share your observer link
        </h2>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this to people who know you well. Each one anonymously picks the
          words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>

      <div className="mt-12 border-t border-hair pt-8">
        <Link
          href="/assessment/result"
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Back to your result
        </Link>
      </div>
    </div>
  );
}

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't change the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
 * Mirrors the helper on the result page (issue #8).
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
