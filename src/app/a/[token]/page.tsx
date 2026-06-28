import Link from "next/link";
import { getSubjectByShareToken } from "@/lib/assessment/observers";
import { shuffledWordList } from "@/lib/assessment/selection";
import { WordSelector } from "@/app/assessment/word-selector";
import { submitObserverResponse } from "./actions";

/**
 * The anonymous 360 Observer page (issue #8, ADR-0003). An Observer opens the
 * Subject's shareable link and selects the words that describe that named
 * person — no sign-in required. The word list is the same flat, unlabeled,
 * freshly-shuffled set the Subject sees, gated to the same 8–15 range, so self
 * and observer scores stay comparable.
 *
 * `params` is a Promise in Next 16 — await it. An unknown token renders a
 * graceful "link not found" state rather than the word UI.
 */
export default async function ObserverPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const subject = await getSubjectByShareToken(token);

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
          An outside read
        </p>
        <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
          Which words describe {subject.name}?
        </h1>
        <p className="mt-3 max-w-[560px] text-[16px] text-muted">
          Someone asked for your honest read on how {subject.name} is wired — not
          how they wish to be seen. Choose the words that genuinely fit. Your
          answer is anonymous, and the order is shuffled each time.
        </p>

        <WordSelector
          words={words}
          action={submitObserverResponse}
          submitLabel="Submit my read"
          hidden={{ token }}
        />
      </div>
    </main>
  );
}

/** Shown when a token doesn't resolve to a Subject (expired, mistyped, revoked). */
function InvalidLink() {
  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Link not found
        </p>
        <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
          This observer link isn&rsquo;t valid.
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          The link may be mistyped or no longer active. Ask whoever shared it to
          send you a fresh one.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Go to Tribe·Index
        </Link>
      </div>
    </main>
  );
}
