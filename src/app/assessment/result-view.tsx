import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/result";

/**
 * The enriched Self Assessment result view (#6): the Primary (and qualifying
 * Secondary) headline, the full 12-tribe ranking as proportional bars, the words
 * the Subject picked, and prominent links into the full tribe profile page(s).
 *
 * It is a pure presentational component — every input is already computed and
 * serializable (no DB, no scoring, no `server-only` code), so it renders
 * identically whether shown right after submitting or when a Subject revisits
 * their saved current result, and the profile page (#18) can reuse it unchanged.
 */
export interface ResultViewProps {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes, already ranked highest-first by normalized score. */
  ranking: readonly RankedTribe[];
  /** The words the Subject selected, in selection order. */
  words: readonly string[];
}

export function ResultView({
  primary,
  secondary,
  ranking,
  words,
}: ResultViewProps) {
  // Bars are drawn relative to the leading score so the top tribe fills the
  // track and the rest read proportionally against it.
  const topScore = ranking[0]?.score ?? 0;
  const headlineSlugs = new Set(
    [primary.slug, secondary?.slug].filter(Boolean) as string[],
  );

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          Your tribe
        </p>

        <TribeHeadline tribe={primary} />

        {secondary && (
          <>
            <p className="mt-12 text-[12px] uppercase tracking-[0.2em] text-faint">
              With a strong secondary
            </p>
            <TribeHeadline tribe={secondary} />
          </>
        )}

        {/* The full 12-tribe ranking — why the Subject got this result. */}
        <section className="mt-16 border-t border-hair pt-10">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </p>
          <ol className="mt-6 flex flex-col gap-[14px]">
            {ranking.map((tribe) => {
              const pct = topScore > 0 ? (tribe.score / topScore) * 100 : 0;
              const isHeadline = headlineSlugs.has(tribe.slug);
              return (
                <li
                  key={tribe.slug}
                  style={
                    { "--accent": accentHex(tribe.color) } as React.CSSProperties
                  }
                  className="flex items-center gap-4"
                >
                  <span
                    className={`w-[92px] shrink-0 font-serif text-[18px] leading-tight ${
                      isHeadline ? "text-ink" : "text-muted"
                    }`}
                  >
                    {tribe.name}
                  </span>
                  <span className="relative h-[8px] flex-1 overflow-hidden rounded-full bg-stone">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: "var(--accent)",
                        opacity: isHeadline ? 1 : 0.4,
                      }}
                    />
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-[12px] tabular-nums text-faint">
                    {Math.round(tribe.score * 100)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The words the Subject picked — connecting choices to the outcome. */}
        <section className="mt-14 border-t border-hair pt-10">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you picked
          </p>
          <ul className="mt-5 flex flex-wrap gap-[10px]">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-full border border-hair px-[14px] py-[6px] text-[13px] text-muted"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
          <Link
            href={`/tribes/${primary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {primary.name} profile
          </Link>
          {secondary && (
            <Link
              href={`/tribes/${secondary.slug}`}
              className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
            >
              Read the full {secondary.name} profile
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <h1 className="font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
        <span style={{ color: "var(--accent)" }}>{tribe.name}</span>
      </h1>
      <div className="mt-1 font-serif text-[22px] italic text-muted">
        {tribe.callSign} ·{" "}
        <span className="font-hebrew not-italic">{tribe.hebrew}</span>
      </div>
      <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">
        {tribe.essence}
      </div>
    </div>
  );
}

/** Maps a tribe's Tailwind color name to its accent hex (mirrors page.tsx / the detail page). */
function accentHex(color: string): string {
  const map: Record<string, string> = {
    amber: "#b8860b",
    violet: "#7c5cbf",
    blue: "#2f6fb0",
    emerald: "#2f8f63",
    orange: "#c2691f",
    red: "#b23535",
    slate: "#6b7280",
    cyan: "#1f97aa",
    lime: "#6f9420",
    zinc: "#7c7c85",
    yellow: "#b8961a",
    rose: "#bf3a52",
  };
  return map[color] ?? "#a9842f";
}
