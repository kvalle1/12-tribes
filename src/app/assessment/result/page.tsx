import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";
import { rankForDisplay } from "@/lib/assessment/ranking";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view — headline, the ranked 12-tribe bars, the chosen words,
 * and links into the tribe profiles — is rendered by the shared `ResultView`
 * component (issue #6), reused by the profile page (#18). Scoring runs here on
 * the server from the saved `words` (the source of truth) so the ranking can
 * never drift from the stored result and the word→tribe mapping stays off the
 * client (ADR-0009). This page is reached both right after submitting and when a
 * Subject returns to their saved result, so the view is identical either way.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const { primary, secondary } = resolveHeadline(
    row.primarySlug,
    row.secondarySlug,
  );
  const ranked = rankForDisplay(score(row.words));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView
          primary={primary}
          secondary={secondary}
          ranked={ranked}
          words={row.words}
        />
      </div>
    </main>
  );
}
