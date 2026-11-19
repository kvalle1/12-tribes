import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";

/**
 * Confirmation shown after the Subject completes the paged Self Assessment. The
 * result itself lives on the account/profile page; this just confirms the
 * answers were saved and links there.
 */
export default async function AssessmentCompletePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/complete")}`);
  }

  // Only reachable once a result is saved; otherwise start the assessment.
  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          Assessment complete
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Your answers are saved
        </h1>
        <p className="mt-3 max-w-[460px] text-[16px] text-muted">
          You&rsquo;ve finished all five pages. Your results are ready to view
          in your account.
        </p>

        <Link
          href="/account"
          className="mt-8 inline-block rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          View my results
        </Link>
      </div>
    </main>
  );
}
