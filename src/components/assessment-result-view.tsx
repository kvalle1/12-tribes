import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { buildResultView, type RankedTribe } from "@/lib/assessment/result-view";

/**
 * The enriched Self Assessment result view (#6): the Primary (and Secondary)
 * headline, the full 12-tribe ranking as proportional bars, the Subject's
 * selected words, and prominent links into the `/tribes/[slug]` profiles.
 *
 * It is a server component fed a stored result row, so it renders identically
 * whether shown right after submitting or when revisiting the saved current
 * result — and the profile page (#18) reuses it unchanged.
 */
export function AssessmentResultView({
  row,
}: {
  row: { words: string[]; primarySlug: string; secondarySlug: string | null };
}) {
  const { primary, secondary, ranked, words } = buildResultView({
    words: row.words,
    primarySlug: row.primarySlug,
    secondarySlug: row.secondarySlug,
  });

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
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

      {/* Prominent profile links */}
      <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
        <Link
          href={`/tribes/${primary.slug}`}
          className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
        >
          Read the full {primary.name} profile →
        </Link>
        {secondary && (
          <Link
            href={`/tribes/${secondary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {secondary.name} profile →
          </Link>
        )}
      </div>

      {/* The full 12-tribe ranking */}
      <section className="mt-16">
        <h2 className="border-b border-hair pb-2 text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ol className="mt-6 flex flex-col gap-[18px]">
          {ranked.map((r, i) => (
            <RankedBar key={r.tribe.slug} row={r} rank={i + 1} />
          ))}
        </ol>
      </section>

      {/* The words the Subject picked */}
      <section className="mt-16">
        <h2 className="border-b border-hair pb-2 text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
          <span className="ml-2 text-faint/70">({words.length})</span>
        </h2>
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-stone/40 px-3 py-1.5 text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RankedBar({ row, rank }: { row: RankedTribe; rank: number }) {
  const { tribe, barPct, score, isPrimary, isSecondary } = row;
  const accent = accentHex(tribe.color);
  const highlighted = isPrimary || isSecondary;
  const pct = Math.round(score * 100);

  return (
    <li
      className="grid grid-cols-[28px_minmax(0,1fr)_44px] items-center gap-4"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <span className="text-[11px] tabular-nums text-faint">
        {String(rank).padStart(2, "0")}
      </span>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <Link
            href={`/tribes/${tribe.slug}`}
            className={`font-serif leading-none transition-colors hover:text-gold ${
              highlighted
                ? "text-[19px] font-semibold text-ink"
                : "text-[16px] text-muted"
            }`}
          >
            {tribe.name}
            {isPrimary && (
              <span className="ml-2 align-middle text-[9.5px] uppercase tracking-[0.16em] text-gold">
                Primary
              </span>
            )}
            {isSecondary && (
              <span className="ml-2 align-middle text-[9.5px] uppercase tracking-[0.16em] text-gold">
                Secondary
              </span>
            )}
          </Link>
        </div>
        {/* Decorative: the value is conveyed by the adjacent `{pct}%` text,
            so the bar is hidden from assistive tech to avoid a duplicate read. */}
        <div
          aria-hidden="true"
          className="h-[7px] w-full overflow-hidden rounded-full bg-hair/60"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPct}%`,
              background: "var(--accent)",
              opacity: highlighted ? 1 : 0.55,
            }}
          />
        </div>
      </div>

      <span className="text-right text-[12px] tabular-nums text-faint">
        {pct}%
      </span>
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
