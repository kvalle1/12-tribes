import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MAX_WORDS, MIN_WORDS, WORDS } from "@/lib/assessment/words";
import { shuffle } from "@/lib/assessment/shuffle";
import { WordSelection } from "./word-selection";

/**
 * The login-gated Self Assessment (ADR-0004). Sign-in is required before taking
 * it, so an unauthenticated visitor is routed through magic-link sign-in and
 * returned here afterwards.
 *
 * Reading the session opts this route into dynamic rendering, so the word list
 * is re-shuffled on every visit — the order differs each session (PRD story 5)
 * and the page is never statically cached with one fixed order.
 */
export default async function AssessmentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment")}`);
  }

  // Only the word strings cross to the client — the tribe mapping stays here.
  const words = shuffle(WORDS.map((w) => w.word));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[760px] px-8 py-[96px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          The Assessment
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] leading-[1.6] text-muted">
          Select the words that describe you — between {MIN_WORDS} and{" "}
          {MAX_WORDS}. Don&rsquo;t overthink it; choose the ones that ring true.
        </p>

        <WordSelection words={words} min={MIN_WORDS} max={MAX_WORDS} />
      </div>
    </main>
  );
}
