import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * The signed-in user's profile — a stable place that represents their tribe
 * (issue #18, PRD stories 16/17). It shows the Account's single current result
 * (ADR-0004) via the shared `ResultView` (issue #6), the same view shown right
 * after submitting the assessment, so the profile never drifts from the result.
 *
 * Login-gated: an unauthenticated visitor is routed through magic-link sign-in
 * and returned here afterwards. A signed-in user who hasn't taken the assessment
 * yet sees a prompt to start it rather than an empty result.
 */
export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/account")}`);
  }

  const row = await getCurrentResult(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4 border-b border-hair pb-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              Your profile
            </p>
            <p className="mt-2 font-serif text-[18px]">
              Signed in as{" "}
              <span className="text-gold">{session.user.email}</span>
            </p>
          </div>
          <SignOutButton />
        </div>

        {row ? (
          <div className="mt-12">
            <ResultView
              words={row.words}
              primarySlug={row.primarySlug}
              secondarySlug={row.secondarySlug}
            />
          </div>
        ) : (
          <section className="mt-12">
            <h1 className="font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
              You haven&rsquo;t found your tribe yet.
            </h1>
            <p className="mt-4 max-w-[520px] text-[16px] text-muted">
              Take the assessment to discover your Primary tribe. Your result is
              saved here, so you can return to it any time.
            </p>
            <Link
              href="/assessment"
              className="mt-8 inline-block rounded-[2px] bg-ink px-[34px] py-[15px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
            >
              Take the Assessment
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
