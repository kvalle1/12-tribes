import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverSelections } from "@/lib/observer/repository";
import { ComparisonReport } from "@/components/comparison-report";

/**
 * The Subject's 360 comparison report (issue #9, ADR-0003): their own profile
 * against the equal-weight "others" read, unlocking once at least three
 * observers have responded. Login-gated like the rest of the account flow
 * (ADR-0004) — an unauthenticated visitor routes through sign-in, and a
 * signed-in user who hasn't taken the assessment is sent to start it (there is
 * no self profile to compare against yet).
 *
 * All scoring and aggregation happen server-side here; only the bare observer
 * word selections (never any observer identity — there is none stored) and the
 * Subject's own saved selection feed the report (ADR-0009).
 */
export default async function ComparePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const observerSelections = await getObserverSelections(session.user.id);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <ComparisonReport
          selfWords={row.words}
          observerSelections={observerSelections}
        />
      </div>
    </main>
  );
}
