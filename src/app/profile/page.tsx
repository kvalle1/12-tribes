import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * Profile — a signed-in user's way back to their saved result from the home
 * page (issue #18, ADR-0004). It renders the Account's current result with the
 * same shared `ResultView` used right after submitting (#6) and on the
 * /assessment/result page, so there's one canonical result rendering.
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in (returning
 * here afterwards), and a signed-in user who hasn't taken the assessment yet is
 * sent to start it — the home-page "View your results" entry is only surfaced
 * once a saved result exists, so this is the direct-navigation fallback.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

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

        <section className="mt-14 flex flex-wrap gap-x-7 gap-y-3 border-t border-hair pt-8 text-[13px] tracking-[0.08em]">
          <Link
            href="/assessment/result"
            className="border-b border-gold pb-1 text-ink transition-colors hover:text-gold"
          >
            Share &amp; compare (360)
          </Link>
          <Link
            href="/assessment"
            className="border-b border-hair pb-1 text-muted transition-colors hover:text-ink"
          >
            Retake the assessment
          </Link>
        </section>
      </div>
    </main>
  );
}
