import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponsesForSubject } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The 360 comparison report for the signed-in Subject (issue #9, ADR-0003):
 * their own profile beside the equal-weight "others" profile aggregated from
 * anonymous observer responses. Login-gated like the rest of the assessment — an
 * unauthenticated visitor is routed through sign-in, and a signed-in user who
 * hasn't taken the assessment yet is sent to start it (there's no self read to
 * compare against otherwise).
 *
 * All scoring and aggregation happen here on the server; the client only ever
 * receives the already-computed report markup (ADR-0009).
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/comparison")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponsesForSubject(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <ComparisonReport selfWords={row.words} responses={responses} />
      </div>
    </main>
  );
}
