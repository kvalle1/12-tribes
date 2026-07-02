import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import {
  MIN_OBSERVERS_FOR_REPORT,
  hasEnoughObservers,
} from "@/lib/assessment/constants";
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

  // Compose the absolute observer link. Prefer the canonical configured origin
  // (`AUTH_URL`, the same trusted origin Auth.js uses) so the copied link can't
  // be skewed by a forwarded `Host` header; fall back to the request host, then
  // to a relative path, when it isn't set.
  const shareUrl = `${await observerLinkBase()}/a/${row.shareToken}`;

  // How many anonymous Observers have responded so far — drives the report's
  // locked/unlocked entry below (issue #9).
  const observerCount = (await getObserverResponses(session.user.id)).length;
  const reportUnlocked = hasEnoughObservers(observerCount);

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

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
            {reportUnlocked ? (
              <Link
                href="/assessment/report"
                className="border-b border-gold pb-1 tracking-[0.06em] text-ink transition-colors hover:text-gold"
              >
                View your 360 comparison →
              </Link>
            ) : (
              <span className="text-muted">
                {observerCount} of {MIN_OBSERVERS_FOR_REPORT} responses in — your
                comparison unlocks at {MIN_OBSERVERS_FOR_REPORT}.
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * The origin the shareable observer link is built against. Prefers the
 * configured `AUTH_URL` (trusted, set per deployment) so a forwarded `Host`
 * header can't change the link a Subject copies; falls back to the request host
 * for local/dev where `AUTH_URL` may be unset, and finally to a relative path.
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
