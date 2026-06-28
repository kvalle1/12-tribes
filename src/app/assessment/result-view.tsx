import "server-only";
import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  buildRanking,
  resolveHeadline,
  type RankedTribe,
} from "@/lib/assessment/result";

/**
 * The full result view (#6), shown both right after submitting and when a
 * Subject returns to their saved current result — it's one component so the two
 * render identically. The profile page (#18) reuses it too.
 *
 * It recomputes the 12-tribe ranking from the stored `words` via the pure scoring
 * core, so the bars can never drift from the source-of-truth selection. Scoring
 * runs here on the server (`server-only`); the word→tribe mapping never reaches
 * the client.
 */
export interface ResultViewProps {
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranking = buildRanking(score(words), primarySlug, secondarySlug);

  return (
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

      {/* Why this result — every tribe ranked by normalized score. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How the twelve scored
        </p>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranking.map((row) => (
            <RankingBar key={row.slug} row={row} />
          ))}
        </ul>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </p>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-stone px-[14px] py-[7px] text-[13px] tracking-[0.02em] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions + prominent links into the full profiles. */}
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
    </div>
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

/**
 * One tribe's ranked bar. The fill is proportional to the tribe's score relative
 * to the top tribe; the Primary (and Secondary) are emphasized so the headline
 * ties visibly to the ranking.
 */
function RankingBar({ row }: { row: RankedTribe }) {
  const accent = accentHex(row.color);
  const emphasized = row.isPrimary || row.isSecondary;

  return (
    <li
      className="grid grid-cols-[110px_1fr] items-center gap-[14px]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Link
        href={`/tribes/${row.slug}`}
        className={`text-[13px] tracking-[0.02em] transition-colors hover:text-gold ${
          emphasized ? "font-semibold text-ink" : "text-muted"
        }`}
      >
        {row.name}
        {row.isPrimary && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            1°
          </span>
        )}
        {row.isSecondary && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            2°
          </span>
        )}
      </Link>
      <div className="h-[10px] w-full overflow-hidden rounded-[2px] bg-stone">
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${Math.round(row.fraction * 100)}%`,
            backgroundColor: "var(--accent)",
            opacity: emphasized ? 1 : 0.45,
          }}
        />
      </div>
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
