import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { ResultView } from "@/components/result-view";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full 12-tribe ranking is recomputed here from the stored `words` by the
 * pure scoring core, so the saved `words` stay the source of truth and the
 * derived ranking can never drift from them. The page renders the same
 * `ResultView` whether reached right after submitting or when revisiting the
 * saved result (issue #6); the profile page (#18) reuses the component too.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const scores = score(row.words);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10">
          <ResultView
            scores={scores}
            words={row.words}
            primarySlug={row.primarySlug}
            secondarySlug={row.secondarySlug}
          />
        </div>

        <div className="mt-14 border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
