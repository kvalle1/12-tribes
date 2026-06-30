import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/result";

/**
 * The full Self Assessment result view (#6): the headline Primary (and Secondary
 * when one qualifies), the ranked 12-tribe Strength Profile as proportional
 * bars, the words the Subject chose, and prominent links into the full tribe
 * profile page(s).
 *
 * Presentational and self-contained — it takes already-resolved data (the server
 * computes the ranking with the scoring core), so it renders identically whether
 * shown right after submitting or when a Subject revisits their saved current
 * result, and the profile page (#18) can reuse it unchanged.
 */
export function ResultView({
  ranked,
  words,
}: {
  ranked: RankedTribe[];
  words: string[];
}) {
  const primary = ranked.find((r) => r.isPrimary)?.tribe ?? ranked[0].tribe;
  const secondary = ranked.find((r) => r.isSecondary)?.tribe;

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

        {/* Profile links — the prominent way into the deeper write-up(s). */}
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
              className="border-b border-hair pb-1 text-[13px] tracking-[0.08em] text-muted transition-colors hover:text-ink"
            >
              Read the {secondary.name} profile
            </Link>
          )}
        </div>

        {/* The full Strength Profile — why this result, all 12 tribes ranked. */}
        <section className="mt-16">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </p>
          <ul className="mt-6 space-y-[10px]">
            {ranked.map((row) => (
              <RankedBar key={row.tribe.slug} row={row} />
            ))}
          </ul>
        </section>

        {/* The Subject's own choices, so they can connect input to outcome. */}
        <section className="mt-16">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
            <span className="ml-2 text-muted">({words.length})</span>
          </p>
          <ul className="mt-5 flex flex-wrap gap-[10px]">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-full border border-hair px-[14px] py-[6px] text-[13px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function RankedBar({ row }: { row: RankedTribe }) {
  const { tribe, percent, isPrimary, isSecondary } = row;
  const accent = accentHex(tribe.color);
  const emphasized = isPrimary || isSecondary;

  return (
    <li>
      <Link
        href={`/tribes/${tribe.slug}`}
        className="group block rounded-[2px] px-1 py-[6px] transition-colors hover:bg-stone"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span
            className={
              emphasized
                ? "font-serif text-[18px] font-semibold text-ink"
                : "font-serif text-[18px] text-muted"
            }
          >
            {tribe.name}
            {isPrimary && (
              <span className="ml-3 align-middle text-[10px] uppercase tracking-[0.16em] text-faint">
                Primary
              </span>
            )}
            {isSecondary && (
              <span className="ml-3 align-middle text-[10px] uppercase tracking-[0.16em] text-faint">
                Secondary
              </span>
            )}
          </span>
          <span className="text-[12px] tabular-nums text-faint">
            {Math.round(percent)}%
          </span>
        </div>
        <div className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full bg-hair">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${percent}%`,
              backgroundColor: "var(--accent)",
              opacity: emphasized ? 1 : 0.55,
            }}
          />
        </div>
      </Link>
    </li>
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
