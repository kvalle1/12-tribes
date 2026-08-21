import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { PROFILE_PATH } from "@/lib/profile";
import { ResultView } from "@/components/result-view";

/**
 * The Account's profile page (issue #18, ADR-0004): a stable place a signed-in
 * user can return to and see their saved current result, reachable from the
 * home page's "View your results" entry.
 *
 * It renders the same `ResultView` used post-submit and on the assessment result
 * page (issue #6), so the result looks identical everywhere. Unlike the
 * assessment result page it omits the 360 observer-share section — the profile
 * is about viewing your own result, not inviting observers.
 *
 * Access rules: an unauthenticated visitor is routed through sign-in and back
 * here; a signed-in user who hasn't taken the assessment yet sees a gentle empty
 * state inviting them to start (they won't normally arrive here, since the home
 * entry is hidden for them, but a direct visit is handled gracefully).
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(PROFILE_PATH)}`);
  }

  const row = await getCurrentResult(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {row ? (
          <ResultView
            words={row.words}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </main>
  );
}

/**
 * Shown when a signed-in user reaches their profile before taking the
 * assessment. Invites them into the flow rather than dead-ending.
 */
function EmptyState() {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your profile
      </p>
      <h1 className="mt-4 font-serif text-[clamp(32px,5vw,52px)] font-semibold leading-[1.04]">
        You haven&rsquo;t found your tribe yet.
      </h1>
      <p className="mt-4 max-w-[520px] text-[16px] text-muted">
        Take the assessment to discover your Primary tribe. Your result is saved
        here so you can return to it any time.
      </p>
      <div className="mt-9">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Take the Assessment
        </Link>
      </div>
    </div>
  );
}
