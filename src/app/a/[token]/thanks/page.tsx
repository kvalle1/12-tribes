import Link from "next/link";

/**
 * Confirmation shown after an anonymous 360 Observer submits their read (issue
 * #8). No Subject detail or result is revealed here — the comparison report is
 * the Subject's alone (ADR-0003) and unlocks at ≥3 responses (issue #9).
 */
export default function ObserverThanksPage() {
  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[560px] px-8 py-[120px]">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Thank you
        </p>
        <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
          Your read has been recorded.
        </h1>
        <p className="mt-3 text-[16px] text-muted">
          It was submitted anonymously — no name or relationship is attached. The
          person who asked will see how the outside reads line up with their own.
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
