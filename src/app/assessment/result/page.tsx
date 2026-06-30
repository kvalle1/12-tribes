import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AssessmentResult } from "@/components/assessment-result";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankByScore, score } from "@/lib/assessment/score";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The 12-tribe ranking is recomputed here, on the server, from the stored
 * `words` by the pure scoring core (the same path the save used), so the
 * displayed bars can never drift from the saved selection and the word→tribe
 * mapping never reaches the client (ADR-0009). Because this page always reads
 * the saved current result, the view renders identically whether reached right
 * after submitting or when the Subject returns to it later.
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
  const scores = rankByScore(score(row.words));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <AssessmentResult
          words={row.words}
          scores={scores}
          primary={primary}
          secondary={secondary}
        />
      </div>
    </main>
  );
}
