import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile — a durable place to return to their saved Self
 * Assessment result from the home page (issue #18, ADR-0004). Login-gated: an
 * unauthenticated visitor is routed through magic-link sign-in and back here.
 *
 * The result is rendered by the shared `ResultView` (issue #6) — the same view
 * shown right after submitting and on the post-assessment result page — so the
 * result looks identical everywhere. A signed-in user who hasn't taken the
 * assessment yet (they can only reach this page by direct URL; the home entry is
 * hidden for them) gets a gentle prompt to take it rather than an empty screen.
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
          <div>
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              Your profile
            </p>
            <h1 className="mt-4 font-serif text-[clamp(32px,5vw,48px)] font-semibold leading-[1.05]">
              You haven&rsquo;t taken the assessment yet
            </h1>
            <p className="mt-4 max-w-[520px] text-[16px] text-muted">
              Choose the words that ring true and we&rsquo;ll show you the tribe
              whose name you already carry. Your result is saved here so you can
              return to it anytime.
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
        )}
      </div>
    </main>
  );
}
