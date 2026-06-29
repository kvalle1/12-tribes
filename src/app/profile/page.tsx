import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's profile — a stable place that represents their tribe (PRD story
 * 17, ADR-0004). It shows the Account's single current result via the shared
 * `ResultView`, so it renders identically to the post-submit `/assessment/result`
 * page.
 *
 * Login-gated: a signed-out visitor is routed through magic-link sign-in and
 * returned here. A signed-in user who hasn't taken the assessment is sent to
 * start it (the home-page "View your results" entry only appears once a result
 * exists, so this is the rare direct-navigation case).
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/profile")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const headline = resolveHeadline(row.primarySlug, row.secondarySlug);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView headline={headline} />
      </div>
    </main>
  );
}
