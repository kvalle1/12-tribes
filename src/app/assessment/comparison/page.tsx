import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's self-vs-others 360 comparison (issue #9, ADR-0003). Login-gated
 * like the result page: an unauthenticated visitor is routed through sign-in,
 * and a signed-in user who hasn't taken the assessment is sent to start it —
 * there's no self profile to compare against otherwise.
 *
 * It loads the Subject's saved selection plus every anonymous Observer response
 * and hands the raw words to `ComparisonReport`, which scores both sides with
 * the shared core and gates itself to the ≥3-observer unlock. Nothing here (or
 * in the report) carries observer identity.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  const result = await getCurrentResult(session.user.id);
  if (!result) redirect("/assessment");

  const observerWords = await getObserverResponses(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport
          selfWords={result.words}
          observerWords={observerWords}
        />
      </div>
    </main>
  );
}
