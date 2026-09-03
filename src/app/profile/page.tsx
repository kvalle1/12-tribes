import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile — a stable place that represents their tribe (issue
 * #18, PRD stories 16–17). Login-gated: an unauthenticated visitor is routed
 * through sign-in and returned here afterward.
 *
 * A signed-in Subject who has taken the assessment sees their current saved
 * result rendered by the shared `ResultView` (issue #6) — the very same view
 * shown right after submitting and when revisiting the saved result, so the
 * profile can never drift from the result page. A signed-in user who hasn't
 * taken it yet gets a gentle prompt to do so rather than a dead end.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
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
          <EmptyProfile />
        )}
      </div>
    </main>
  );
}

/**
 * Shown to a signed-in Subject who has no saved result yet — a friendly nudge
 * into the assessment instead of an empty page. (The home-page "View your
 * results" entry stays hidden for this user, so they normally reach here only
 * by navigating directly.)
 */
function EmptyProfile() {
  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your profile
      </p>
      <h1 className="mt-4 font-serif text-[clamp(34px,6vw,56px)] font-semibold leading-[1.05]">
        You haven&rsquo;t found your tribe yet.
      </h1>
      <p className="mt-5 max-w-[520px] text-[16px] text-muted">
        Take the assessment to discover your Primary tribe — the words you pick
        map you to one of the twelve. Your result is saved here so you can return
        to it any time.
      </p>
      <div className="mt-10">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[34px] py-[15px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Take the Assessment
        </Link>
      </div>
    </div>
  );
}
