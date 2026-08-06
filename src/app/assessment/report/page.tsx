import Link from "next/link";
import { headers } from "next/headers";
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
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 self-vs-others comparison report (issue #9, ADR-0003). Login-gated and
 * tied to the signed-in Subject: an unauthenticated visitor is routed through
 * sign-in, and a signed-in user who hasn't taken the Self Assessment is sent to
 * start it (there is no self profile to compare against yet).
 *
 * The report stays locked until at least three Observers have responded — enough
 * that the aggregate is meaningful and no single Observer can be identified. The
 * locked state shows progress toward that threshold and the share link so the
 * Subject can invite more people; the unlocked state renders the full
 * `ComparisonReport`. All scoring/aggregation runs here on the server; the client
 * only ever receives computed scores.
 */
export default async function AssessmentReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const { count, others, observers } = aggregateObservers(responses);
  const unlocked = isReportUnlocked(count);
  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The 360 read
        </p>
        <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
          How others see you
        </h1>

        {unlocked ? (
          <>
            <p className="mt-4 max-w-[540px] text-[15px] text-muted">
              {count} {count === 1 ? "person has" : "people have"} weighed in.
              Each was counted equally, however many words they picked — so the
              &ldquo;others&rdquo; view is the room, not the loudest voice.
            </p>
            <div className="mt-12">
              <ComparisonReport
                selfScores={score(row.words)}
                others={others}
                observers={observers}
              />
            </div>
          </>
        ) : (
          <LockedState count={count} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

function LockedState({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = MIN_OBSERVERS_FOR_REPORT - count;

  return (
    <div className="mt-8">
      <div className="rounded-[2px] border border-hair bg-stone/40 p-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Locked
        </p>
        <h2 className="mt-3 font-serif text-[24px] font-semibold leading-snug">
          {count === 0
            ? "No observers yet"
            : `${count} of ${MIN_OBSERVERS_FOR_REPORT} responses in`}
        </h2>
        <p className="mt-3 max-w-[520px] text-[15px] text-muted">
          Your comparison unlocks once{" "}
          <strong className="font-semibold text-ink">
            {MIN_OBSERVERS_FOR_REPORT} people
          </strong>{" "}
          have described you. That keeps the aggregate meaningful and every
          observer anonymous.{" "}
          {remaining > 0 &&
            `${remaining} more ${remaining === 1 ? "response" : "responses"} to go.`}
        </p>

        {/* Progress toward the unlock threshold. */}
        <div
          className="mt-6 flex gap-2"
          role="img"
          aria-label={`${count} of ${MIN_OBSERVERS_FOR_REPORT} observer responses`}
        >
          {Array.from({ length: MIN_OBSERVERS_FOR_REPORT }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i < count ? "bg-gold" : "bg-hair"
              }`}
            />
          ))}
        </div>
      </div>

      <section className="mt-10">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite your observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to 3–5 people who know you well. Each one anonymously
          picks the words that describe you.
        </p>
        <ObserverShareLink url={shareUrl} />
      </section>
    </div>
  );
}

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't skew the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
 * Mirrors the helper on the result page so both surfaces build identical links.
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
