import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/result-repository";
import { getTribeBySlug } from "@/lib/tribes";

/**
 * Headline result for the Self Assessment (PRD #3, slice #5).
 *
 * Reads the Account's saved current result, so it renders the same whether shown
 * right after submitting or when the participant returns to it later. A missing
 * result routes back to the intake. The richer view — all 12 ranked bars, the
 * words you picked, prominent profile links — is the next slice (#6); here we
 * show the Primary (and qualified Secondary) headline only.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/assessment/result");
  }

  const current = await getCurrentResult(session.user.id);
  if (!current) {
    redirect("/assessment");
  }

  const { primary, secondary } = current.result;
  const primaryTribe = getTribeBySlug(primary.slug);
  const secondaryTribe = secondary ? getTribeBySlug(secondary.slug) : undefined;

  // The result is derived from `tribes`, so the slug always resolves; this guard
  // is a type-safety belt rather than an expected branch.
  if (!primaryTribe) {
    redirect("/assessment");
  }

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 rounded-[2px] border border-gold/40 bg-gold/5 p-8">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Your tribe
          </div>
          <div className="mt-3 font-hebrew text-[34px] font-medium text-gold">
            {primaryTribe.hebrew}
          </div>
          <h1 className="mt-2 font-serif text-[44px] font-semibold leading-[1.04]">
            {primaryTribe.name}
          </h1>
          <div className="mt-1 font-serif text-[20px] italic text-muted">
            {primaryTribe.callSign}
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-[0.13em] text-faint">
            {primaryTribe.essence}
          </div>

          <Link
            href={`/tribes/${primaryTribe.slug}`}
            className="mt-6 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full profile →
          </Link>
        </div>

        {secondaryTribe ? (
          <div className="mt-5 rounded-[2px] border border-hair p-6">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              And a strong secondary
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-hebrew text-[22px] text-gold">
                {secondaryTribe.hebrew}
              </span>
              <span className="font-serif text-[24px] font-semibold">
                {secondaryTribe.name}
              </span>
              <span className="font-serif text-[16px] italic text-muted">
                {secondaryTribe.callSign}
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link
            href="/assessment"
            className="text-[13px] uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
          >
            Retake the assessment
          </Link>
        </div>
      </div>
    </main>
  );
}
