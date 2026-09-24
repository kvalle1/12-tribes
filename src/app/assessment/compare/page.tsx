import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { MIN_OBSERVERS, hasEnoughObservers } from "@/lib/observer/constants";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003) — the self-vs-others read that
 * closes the 360 loop. Login-gated like the rest of the assessment: an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment is sent to start it.
 *
 * The report unlocks only once at least three Observers have responded
 * (`MIN_OBSERVERS`); below that it shows a clear locked state with progress and
 * the share link so the Subject can gather more responses. Aggregation and
 * scoring run in the (server-only) `ComparisonReport`, so the word→tribe mapping
 * never reaches the client (ADR-0009).
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const result = await getCurrentResult(session.user.id);
  if (!result) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = hasEnoughObservers(responses.length);

  const shareUrl = `${await observerLinkBase()}/a/${result.shareToken}`;

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
          <ComparisonReport words={result.words} observerResponses={responses} />
        ) : (
          <LockedState count={responses.length} shareUrl={shareUrl} />
        )}
      </div>
    </main>
  );
}

/** The pre-unlock state: progress toward the ≥3 floor + the share link. */
function LockedState({ count, shareUrl }: { count: number; shareUrl: string }) {
  const remaining = MIN_OBSERVERS - count;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.04]">
        Not open yet
      </h1>
      <p className="mt-4 max-w-[540px] text-[15px] text-muted">
        Your comparison unlocks once at least {MIN_OBSERVERS} people have
        answered — enough voices that the combined read means something and stays
        anonymous. So far{" "}
        <span className="text-ink">
          {count === 0
            ? "no one has"
            : `${count} of ${MIN_OBSERVERS} have`}{" "}
          responded
        </span>
        {count > 0 && (
          <>
            {" "}— {remaining} more to go
          </>
        )}
        .
      </p>

      {/* Progress pips toward the floor. */}
      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < count ? "bg-gold" : "bg-hair"
            }`}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
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
 * The origin the shareable observer link is built against. Mirrors the result
 * page: prefer the configured `AUTH_URL` (trusted, set per deployment) so a
 * forwarded `Host` header can't skew the copied link; fall back to the request
 * host for local/dev, and finally to a relative path.
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
