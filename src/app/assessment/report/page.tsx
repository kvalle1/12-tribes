import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { MIN_OBSERVERS_FOR_REPORT } from "@/lib/assessment/aggregateObservers";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003). Login-gated: the Subject views
 * their own report. An unauthenticated visitor is routed through sign-in, and a
 * signed-in user who hasn't taken the Self Assessment is sent to start it (there
 * is no self profile to compare against yet).
 *
 * The report unlocks only once at least {@link MIN_OBSERVERS_FOR_REPORT}
 * Observers have responded — below that the "others" view isn't meaningful and
 * individual Observers wouldn't stay anonymous, so a clear locked state is shown
 * instead, with the share link to gather the remaining reads.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerWordLists = await getObserverResponses(session.user.id);
  const unlocked = observerWordLists.length >= MIN_OBSERVERS_FOR_REPORT;

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
            selfWords={row.words}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
            observerWordLists={observerWordLists}
          />
        ) : (
          <LockedState
            responses={observerWordLists.length}
            shareUrl={`${await observerLinkBase()}/a/${row.shareToken}`}
          />
        )}
      </div>
    </main>
  );
}

/**
 * Shown until at least {@link MIN_OBSERVERS_FOR_REPORT} Observers have responded.
 * Communicates progress toward the threshold and surfaces the share link so the
 * Subject can gather the remaining reads — the report reveals nothing about
 * individual responses before it unlocks (ADR-0003).
 */
function LockedState({
  responses,
  shareUrl,
}: {
  responses: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - responses;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,54px)] font-semibold leading-[1.05]">
        Not unlocked yet
      </h1>
      <p className="mt-4 max-w-[520px] text-[15px] text-muted">
        Your comparison report opens once{" "}
        <strong className="font-semibold text-ink">
          {MIN_OBSERVERS_FOR_REPORT} people
        </strong>{" "}
        have described you. That keeps the &ldquo;others&rdquo; view meaningful
        and every observer anonymous.
      </p>

      <div className="mt-8 rounded-[2px] border border-hair p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Responses so far
          </span>
          <span className="font-serif text-[22px] font-semibold tabular-nums">
            {responses} / {MIN_OBSERVERS_FOR_REPORT}
          </span>
        </div>
        <div
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-hair/50"
          role="img"
          aria-label={`${responses} of ${MIN_OBSERVERS_FOR_REPORT} observer responses received`}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{
              width: `${Math.min((responses / MIN_OBSERVERS_FOR_REPORT) * 100, 100)}%`,
            }}
          />
        </div>
        <p className="mt-4 text-[14px] text-muted">
          {remaining === 1
            ? "Just one more response and your report unlocks."
            : `${remaining} more responses and your report unlocks.`}
        </p>
      </div>

      <section className="mt-10 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Gather more reads
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
