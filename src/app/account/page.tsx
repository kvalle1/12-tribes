import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * The signed-in user's profile — a stable place that represents their tribe
 * (PRD stories 16–17, ADR-0004). It shows the Account's single current saved
 * result via the shared `ResultView` (issue #6), so the profile reads exactly
 * like the post-assessment result. A user who hasn't taken the assessment yet
 * sees an invitation to start it instead.
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in and brought
 * back here afterwards (the home "View your results" entry only links here once
 * a result exists, but the page is reachable directly, so it guards itself).
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/account")}`);
  }

  const result = await getCurrentResult(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-6">
          <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
            Signed in as{" "}
            <span className="text-gold">{session.user.email}</span>
          </p>
          <SignOutButton />
        </div>

        {result ? (
          <div className="mt-12">
            <ResultView
              words={result.words}
              primarySlug={result.primarySlug}
              secondarySlug={result.secondarySlug}
            />
          </div>
        ) : (
          <div className="mt-12">
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              Your profile
            </p>
            <h1 className="mt-4 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
              You haven&rsquo;t found your tribe yet.
            </h1>
            <p className="mt-4 max-w-[480px] text-[17px] text-muted">
              Take the assessment to discover your Primary tribe. Your result
              saves here automatically, so you can return to it any time.
            </p>
            <Link
              href="/assessment"
              className="mt-8 inline-block rounded-[2px] bg-ink px-[34px] py-[15px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
            >
              Take the Assessment
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
