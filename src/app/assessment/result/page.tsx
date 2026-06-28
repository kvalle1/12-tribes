import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { buildResultView } from "@/lib/assessment/view-model";
import { ResultView } from "../result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The view-model is rebuilt from the saved `words` on the server, so the 12-tribe
 * ranking, the chosen words, and the profile links all derive from the same
 * persisted data — and it renders identically whether shown right after submitting
 * or when the Subject returns to this page (issue #6). The same `ResultView` backs
 * the profile page (#18).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const view = buildResultView(row.words, row.primarySlug, row.secondarySlug);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ResultView {...view} />
      </div>
    </main>
  );
}
