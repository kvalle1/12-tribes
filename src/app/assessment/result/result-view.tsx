import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { ResultHeadline, RankedTribeScore } from "@/lib/assessment/result";

/**
 * The full result view (#6): the Primary (and qualifying Secondary) headline, the
 * ranked spectrum of all 12 tribes, the words the Subject chose, and prominent
 * links into the full tribe profiles. Pure presentation — it takes already-scored
 * data and renders, so the same view serves the post-submit page and, later, the
 * profile page (#18). Scoring stays on the server; only normalized scores (no
 * word→tribe mapping) reach this component.
 */
export interface ResultViewProps {
  headline: ResultHeadline;
  /** All 12 tribes, ranked highest-first, with bar widths (see `rankTribeScores`). */
  scores: RankedTribeScore[];
  /** The exact words the Subject selected, in saved order. */
  words: readonly string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ headline, scores, words }: ResultViewProps) {
  const { primary, secondary } = headline;

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

      {/* Why you got this — every tribe ranked by its normalized score. */}
      <section className="mt-16 border-t border-hair pt-8">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {scores.map((row) => (
            <ScoreBar
              key={row.slug}
              row={row}
              isPrimary={row.slug === primary.slug}
              isSecondary={row.slug === secondary?.slug}
            />
          ))}
        </ul>
      </section>

      {/* The Subject's own choices, so they can connect input to outcome. */}
      <section className="mt-16 border-t border-hair pt-8">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
          <span className="ml-2 text-faint tabular-nums">({words.length})</span>
        </h2>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair px-[14px] py-[7px] text-[14px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Read the deeper write-up of the result tribe(s). */}
      <section className="mt-16 border-t border-hair pt-8">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Read the full profile
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          <ProfileLink tribe={primary} label="Primary" />
          {secondary && <ProfileLink tribe={secondary} label="Secondary" />}
        </div>
      </section>
    </>
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

function ScoreBar({
  row,
  isPrimary,
  isSecondary,
}: {
  row: RankedTribeScore;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const tribe = tribeBySlug.get(row.slug);
  const accent = accentHex(tribe?.color ?? "");
  const percent = Math.round(row.score * 100);
  const emphasized = isPrimary || isSecondary;

  return (
    <li
      className="grid grid-cols-[130px_1fr_44px] items-center gap-4 max-[520px]:grid-cols-[96px_1fr_40px]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <span
        className={`font-serif text-[17px] leading-tight max-[520px]:text-[15px] ${
          emphasized ? "font-semibold text-ink" : "text-muted"
        }`}
      >
        {row.name}
        {isPrimary && (
          <span className="ml-1.5 align-middle text-[10px] uppercase tracking-[0.12em] text-faint">
            1°
          </span>
        )}
        {isSecondary && (
          <span className="ml-1.5 align-middle text-[10px] uppercase tracking-[0.12em] text-faint">
            2°
          </span>
        )}
      </span>

      <span
        className="h-[10px] rounded-[2px] bg-hair/60"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-[2px]"
          style={{
            width: `${row.fillPct}%`,
            backgroundColor: "var(--accent)",
            opacity: emphasized ? 1 : 0.55,
          }}
        />
      </span>

      <span className="text-right text-[12px] tabular-nums text-faint">
        {percent}%
      </span>
    </li>
  );
}

function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group flex items-baseline gap-3 text-[15px] text-ink transition-colors hover:text-gold"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span
        className="border-b border-transparent pb-0.5 font-serif text-[20px] group-hover:border-gold"
        style={{ color: "var(--accent)" }}
      >
        {tribe.name}
      </span>
      <span className="text-hair transition-colors group-hover:text-gold">→</span>
    </Link>
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
