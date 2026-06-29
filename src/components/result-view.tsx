import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  buildRanking,
  resolveHeadline,
  type RankedTribe,
} from "@/lib/assessment/result";

/**
 * The enriched Self Assessment result view (#6): the Primary (and Secondary when
 * one qualifies) headline linking to the full tribe profile, the ranked
 * normalized scores for all 12 tribes as proportional bars, and the words the
 * Subject picked.
 *
 * It renders purely from a saved result row (the Subject's selected `words` plus
 * the derived Primary/Secondary slugs), recomputing the 12-tribe ranking from
 * `words` via the pure scoring core. Because it takes only the row, it renders
 * identically whether shown right after submitting or when a Subject revisits
 * their saved current result — and the profile page (#18) can reuse it unchanged.
 *
 * This is a server component: it transitively imports the server-only scoring
 * core, so the word→tribe mapping never reaches the client (ADR-0009).
 */
export interface ResultViewRow {
  words: string[];
  primarySlug: string;
  secondarySlug: string | null;
}

export function ResultView({ row }: { row: ResultViewRow }) {
  const { primary, secondary } = resolveHeadline(row.primarySlug, row.secondarySlug);
  const ranking = buildRanking(score(row.words));
  const headlineSlugs = new Set(
    [primary.slug, secondary?.slug].filter(Boolean) as string[],
  );

  return (
    <>
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

      {/* Ranked normalized scores across all twelve tribes — the "why" behind the
          headline (PRD story 11). */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-gold">
          How every tribe scored
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Each tribe&rsquo;s normalized fit, from the words you chose.
        </p>
        <ol className="mt-7 space-y-[14px]">
          {ranking.map((entry) => (
            <RankingBar
              key={entry.tribe.slug}
              entry={entry}
              highlighted={headlineSlugs.has(entry.tribe.slug)}
            />
          ))}
        </ol>
      </section>

      {/* The words the Subject picked (PRD story 12). */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-gold">
          The words you chose
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          {row.words.length} word{row.words.length === 1 ? "" : "s"}.
        </p>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
          {row.words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-white/60 px-[14px] py-[7px] text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions + prominent profile links (PRD story 13). */}
      <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
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
    </>
  );
}

/**
 * The headline tribe card — links to the full `/tribes/[slug]` profile so the
 * Primary (and Secondary) are a prominent route into the deeper write-up.
 */
function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group mt-4 block"
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
      <div className="mt-2 text-[12px] tracking-[0.04em] text-muted opacity-0 transition-opacity group-hover:opacity-100">
        Read the full profile →
      </div>
    </Link>
  );
}

/** A single ranked tribe row: name, proportional accent bar, and percentage. */
function RankingBar({
  entry,
  highlighted,
}: {
  entry: Pick<RankedTribe, "tribe" | "percent">;
  highlighted: boolean;
}) {
  const { tribe, percent } = entry;
  const accent = accentHex(tribe.color);
  return (
    <li
      className="grid grid-cols-[112px_1fr_42px] items-center gap-4"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <span
        className={`truncate text-[13px] ${
          highlighted ? "font-semibold text-ink" : "text-muted"
        }`}
      >
        {tribe.name}
      </span>
      <span className="h-[10px] overflow-hidden rounded-[2px] bg-black/[0.06]">
        <span
          className="block h-full rounded-[2px]"
          style={{
            width: `${percent}%`,
            backgroundColor: accent,
            opacity: highlighted ? 1 : 0.55,
          }}
        />
      </span>
      <span
        className={`text-right text-[12px] tabular-nums ${
          highlighted ? "text-ink" : "text-faint"
        }`}
      >
        {percent}%
      </span>
    </li>
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
