import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { countObserverResponses } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-url";
import { MIN_OBSERVERS_FOR_REPORT } from "@/lib/assessment/aggregateObservers";
import { ResultView } from "@/components/result-view";
import { ObserverShareLink } from "@/components/observer-share-link";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and when revisiting the saved result, and reused
 * by the profile page (#18). It shows the Primary/Secondary headline, the
 * twelve-tribe ranking bars, the chosen words, and links into the full profiles.
 * Below it, the Subject can share a 360 observer link (issue #8).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const shareUrl = await observerShareUrl(row.shareToken);
  const observerCount = await countObserverResponses(session.user.id);
  const reportUnlocked = observerCount >= MIN_OBSERVERS_FOR_REPORT;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView
          words={row.words}
          primarySlug={row.primarySlug}
          secondarySlug={row.secondarySlug}
        />

        <section className="mt-14 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Get a 360 read
          </p>
          <h2 className="mt-2 font-serif text-[22px] font-semibold leading-snug">
            See how others see you
          </h2>
          <p className="mt-2 max-w-[520px] text-[15px] text-muted">
            Send this link to 3–5 people who know you well. Each one anonymously
            picks the words that describe you, and once at least three respond
            you&rsquo;ll see how their read compares with your own.
          </p>
          <ObserverShareLink url={shareUrl} />

          {/* Progress toward the report, which unlocks at three responses. */}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            {reportUnlocked ? (
              <Link
                href="/assessment/report"
                className="rounded-[2px] bg-ink px-[26px] py-[12px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
              >
                View your 360 report
              </Link>
            ) : (
              <p className="text-[13px] text-muted">
                {observerCount === 0
                  ? "No responses yet."
                  : `${observerCount} of ${MIN_OBSERVERS_FOR_REPORT} responses so far.`}{" "}
                Your report unlocks once{" "}
                {MIN_OBSERVERS_FOR_REPORT} people respond.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
