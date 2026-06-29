import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { buildResultView } from "@/lib/assessment/result-view";
import { AssessmentResult } from "@/components/assessment-result";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full view — the Primary/Secondary headline, the 12-tribe ranking bars, the
 * chosen words, and the profile links — is recomputed from the saved `words` by
 * the pure scoring core (server-side, so the word→tribe mapping never reaches the
 * client). Because everything derives from the saved row, this view is identical
 * whether reached right after submitting or when revisiting the saved result.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const view = buildResultView(row);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <AssessmentResult view={view} />
      </div>
    </main>
  );
}
