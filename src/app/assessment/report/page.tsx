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
  MIN_OBSERVERS,
} from "@/lib/observer/aggregate";
import { ComparisonReport } from "@/components/comparison-report";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * beside the equal-weight aggregate of their anonymous Observers. Login-gated
 * and Subject-only — a visitor's report is derived from *their* saved result and
 * *their* observers.
 *
 * The report unlocks only once at least `MIN_OBSERVERS` (3) people have
 * responded — enough to make the average meaningful and to keep individual
 * Observers anonymous within it. Below that it shows a locked state with the
 * share link so the Subject can gather the remaining reads. All scoring runs on
 * the server; only plain scored data reaches the client components.
 */
export default async function ComparisonReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/report")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponses(session.user.id);
  const unlocked = isReportUnlocked(responses.length);

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
          <LockedReport
            responseCount={responses.length}
            shareUrl={`${await observerLinkBase()}/a/${row.shareToken}`}
          />
        )}
      </div>
    </main>
  );
}

function UnlockedReport({
  words,
  responses,
}: {
  words: string[];
  responses: string[][];
}) {
  const self = score(words);
  const { average, perObserver, observerCount } = aggregateObservers(responses);
  const rows = compareProfiles(self, average);

  return (
    <ComparisonReport
      rows={rows}
      perObserver={perObserver}
      observerCount={observerCount}
    />
  );
}

function LockedReport({
  responseCount,
  shareUrl,
}: {
  responseCount: number;
  shareUrl: string;
}) {
  const remaining = MIN_OBSERVERS - responseCount;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your 360 read
      </p>
      <h1 className="mt-3 font-serif text-[clamp(32px,5.5vw,52px)] font-semibold leading-[1.05]">
        A few more voices to go
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] text-muted">
        Your comparison report unlocks once at least {MIN_OBSERVERS} people have
        described you. That keeps the combined read meaningful and every
        observer anonymous within it. So far{" "}
        <span className="text-ink">
          {responseCount} {responseCount === 1 ? "person has" : "people have"}
        </span>{" "}
        responded — {remaining} more to go.
      </p>

      {/* Progress toward the unlock threshold. */}
      <div className="mt-8 flex items-center gap-2" aria-hidden>
        {Array.from({ length: MIN_OBSERVERS }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i < responseCount ? "bg-gold" : "bg-hair/60"}`}
          />
        ))}
      </div>

      <section className="mt-12 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Invite more observers
        </p>
        <p className="mt-2 max-w-[520px] text-[15px] text-muted">
          Send this link to a few more people who know you well. Each one
          anonymously picks the words that describe you.
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
 * The origin the shareable observer link is built against — mirrors the result
 * page: prefer the trusted configured `AUTH_URL`, fall back to the request host,
 * then to a relative path.
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
