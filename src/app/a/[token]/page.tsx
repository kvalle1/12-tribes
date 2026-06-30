import Link from "next/link";
import { shuffledWordList } from "@/lib/assessment/selection";
import { WordSelector } from "@/components/word-selector";
import { getSubjectByToken } from "@/lib/observer/repository";
import { submitObserverResponse } from "./actions";

/**
 * The anonymous 360 Observer page (issue #8, ADR-0003). Reached via a Subject's
 * shareable link `/a/[token]` — no sign-in required. The Observer sees the same
 * flat, shuffled, unlabeled word list and 8–15 constraint as the Subject, but is
 * prompted to describe the named Subject rather than themselves. The token is
 * bound to the submit action server-side; an unknown token renders a graceful
 * "link not found" instead of the form.
 */
export default async function ObserverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const subject = await getSubjectByToken(token);

  if (!subject) {
    return <InvalidLink />;
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

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          A 360 reflection
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Which words describe {subject.subjectName}?
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] text-muted">
          Someone asked for your honest read. Choose the words that genuinely fit
          how {subject.subjectName} is wired — not how they&rsquo;d like to be
          seen. Your response is{" "}
          <span className="text-ink">completely anonymous</span>: no name, no
          relationship, nothing tying it back to you. The order is shuffled each
          time.
        </p>

        <WordSelector
          words={words}
          action={submitObserverResponse.bind(null, token)}
          submitLabel="Share my read"
        />
      </div>
    </main>
  );
}

/** Friendly, in-theme handling of an unknown or stale observer link. */
function InvalidLink() {
  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <h1 className="mt-10 font-serif text-[40px] font-semibold leading-[1.05]">
          This link isn&rsquo;t valid
        </h1>
        <p className="mt-3 max-w-[460px] text-[16px] text-muted">
          The reflection link you followed doesn&rsquo;t match anyone. It may have
          been mistyped, or the person may have retaken their assessment. Ask them
          for a fresh link.
        </p>

        <div className="mt-10">
          <Link
            href="/"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Explore the twelve tribes
          </Link>
        </div>
      </div>
    </main>
  );
}
