import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The profile page (issue #18): a signed-in Account's home base for its saved
 * result, reachable from the home-page "View your results" entry.
 *
 * Login-gated (ADR-0004): an unauthenticated visitor is routed through sign-in
 * with a callback back here, and a signed-in user who hasn't taken the
 * assessment is sent to start it (the home entry is hidden for them, so this is
 * only reached by direct URL). The result itself is rendered by the shared
 * `ResultView` (issue #6) — the same view shown after submitting and on the
 * saved-result page — so the presentation stays identical everywhere.
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

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Your profile
        </p>

        <div className="mt-4">
          <ResultView
            words={row.words}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        </div>
      </div>
    </main>
  );
}
