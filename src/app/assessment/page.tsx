import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { shuffledWordList } from "@/lib/assessment/selection";
import { WordSelector } from "./word-selector";

/**
 * The login-gated Self Assessment (ADR-0004). Reading the session opts this route
 * into dynamic rendering, so the word list is freshly shuffled on every visit
 * (PRD story 5) and an unauthenticated visitor is routed through magic-link
 * sign-in first, returning here once signed in.
 */
export default async function AssessmentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment")}`);
  }

  const words = shuffledWordList();

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[760px] px-8 py-[88px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          Which words describe you?
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] text-muted">
          Read the list and choose the words that genuinely fit how you&rsquo;re
          wired — not who you wish you were. There are no right answers, and the
          order is shuffled each time.
        </p>

        <WordSelector words={words} />
      </div>
    </main>
  );
}
