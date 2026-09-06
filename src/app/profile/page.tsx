import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { ResultView } from "@/components/result-view";

/**
 * The signed-in Subject's profile — a stable place that shows their current
 * saved result (issue #18, PRD stories 16–17). It reuses the shared `ResultView`
 * (issue #6), so the profile shows the same Primary/Secondary headline, the
 * twelve-tribe ranking bars, the chosen words, and the profile links as the
 * post-submit result page.
 *
 * Login-gated: an unauthenticated visitor is routed through sign-in and returned
 * here afterward (`callbackUrl`), and a signed-in user who hasn't taken the
 * assessment yet is sent to start it — mirroring `/assessment/result`.
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
      </div>
    </main>
  );
}
