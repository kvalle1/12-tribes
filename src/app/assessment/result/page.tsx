import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { observerShareUrl } from "@/lib/observer/share-link";
import { isReportUnlocked, MIN_OBSERVERS_TO_UNLOCK } from "@/lib/observer/compare";
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

  // Compose the absolute observer link (see `observerShareUrl` for how the
  // origin is resolved) and check how many observers have responded so far, so
  // the 360 section can point to the report once it has unlocked.
  const shareUrl = await observerShareUrl(row.shareToken);
  const observerCount = (await getObserverResponsesForSubject(session.user.id))
    .length;
  const reportUnlocked = isReportUnlocked(observerCount);

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
            picks the words that describe you, and once at least{" "}
            {MIN_OBSERVERS_TO_UNLOCK} respond you&rsquo;ll see how their read
            compares with your own.
          </p>
          <ObserverShareLink url={shareUrl} />

          {reportUnlocked ? (
            <Link
              href="/assessment/report"
              className="mt-6 inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
            >
              View your 360 report
            </Link>
          ) : (
            <p className="mt-6 text-[13px] text-faint">
              {observerCount === 0
                ? "No observers yet."
                : `${observerCount} of ${MIN_OBSERVERS_TO_UNLOCK} responses so far.`}{" "}
              Your comparison report unlocks at {MIN_OBSERVERS_TO_UNLOCK}.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
