import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MAX_WORDS, MIN_WORDS, WORDS } from "@/lib/assessment/words";
import { WordSelection } from "./word-selection";

/**
 * Login-gated Self Assessment intake (PRD #3, slice #5; ADR-0004 accounts-first).
 *
 * Sign-in is required: an unauthenticated visitor is routed through magic-link
 * sign-in with a callback back to here, so the result is always tied to an
 * account. Reading the session opts this route into dynamic rendering, and a
 * fresh seed per request gives a new word order each session.
 */
export default async function AssessmentPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/assessment");
  }

  // Only the words cross to the client — the word→tribe mapping is scoring logic
  // and is never shown (PRD stories 4/5). A fresh per-request seed shuffles the
  // list anew each session; the client renders the same order from the seed, so
  // there's no hydration mismatch.
  const words = WORDS.map((entry) => entry.word);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[820px] px-8 py-[88px]">
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
          Read down the list and choose the words that genuinely ring true of
          you — not who you&rsquo;d like to be, but how you&rsquo;re actually
          wired. Pick between {MIN_WORDS} and {MAX_WORDS}.
        </p>

        <WordSelection
          words={words}
          seed={seed}
          min={MIN_WORDS}
          max={MAX_WORDS}
        />
      </div>
    </main>
  );
}
