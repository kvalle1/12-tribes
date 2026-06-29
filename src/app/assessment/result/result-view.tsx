import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankResultScores, type RankedTribe } from "@/lib/assessment/ranking";

/**
 * The full Self Assessment result view (#6). Server-only: it computes the
 * 12-tribe ranking from the saved words via the scoring core (which carries the
 * server-only word→tribe mapping), so the chart never reveals the mapping to the
 * client.
 *
 * Rendered identically wherever a saved result is shown — right after submitting
 * and (issue #18) on the profile page — so both share this one component.
 */
export interface ResultViewProps {
  words: readonly string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankResultScores(words, primarySlug, secondarySlug);

  return (
    <>
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

      {/* Prominent links to the deeper profile write-up(s). */}
      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
        <ProfileLink tribe={primary} label="primary" />
        {secondary && <ProfileLink tribe={secondary} label="secondary" />}
      </div>

      {/* The full reading — every tribe ranked, so the Subject sees why. */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="font-serif text-[26px] font-semibold leading-none">
          How every tribe scored
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          Each bar is your normalized fit for that tribe, ranked highest first.
        </p>

        <ol className="mt-8 flex flex-col gap-3.5">
          {ranked.map((row) => (
            <RankBar key={row.tribe.slug} row={row} />
          ))}
        </ol>
      </section>

      {/* The Subject's own choices, so they can connect picks to the outcome. */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="font-serif text-[26px] font-semibold leading-none">
          The words you chose
        </h2>
        <p className="mt-2 text-[13px] text-muted">
          {words.length} word{words.length === 1 ? "" : "s"} you selected to
          describe yourself.
        </p>

        <ul className="mt-6 flex flex-wrap gap-2.5">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-gold bg-gold/10 px-4 py-2 text-[15px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** One ranked tribe row: name + call sign, a proportional accent bar, percent. */
function RankBar({ row }: { row: RankedTribe }) {
  const { tribe, percent, barFraction, isPrimary, isSecondary } = row;
  const accent = accentHex(tribe.color);

  return (
    <li style={{ "--accent": accent } as React.CSSProperties}>
      <Link
        href={`/tribes/${tribe.slug}`}
        className="block rounded-[2px] px-2 py-1.5 transition-colors hover:bg-white"
      >
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[19px] font-semibold leading-none text-ink">
              {tribe.name}
            </span>
            {(isPrimary || isSecondary) && (
              <span className="text-[10px] uppercase tracking-[0.16em] text-gold">
                {isPrimary ? "Primary" : "Secondary"}
              </span>
            )}
            <span className="text-[12px] italic text-faint">
              {tribe.callSign}
            </span>
          </div>
          <span className="text-[13px] tabular-nums text-muted">
            {percent}%
          </span>
        </div>
        <div className="mt-2 h-[7px] w-full overflow-hidden rounded-[2px] bg-stone">
          <div
            className="h-full rounded-[2px] transition-[width]"
            style={{
              width: `${barFraction * 100}%`,
              background: "var(--accent)",
              opacity: isPrimary || isSecondary ? 1 : 0.55,
            }}
          />
        </div>
      </Link>
    </li>
  );
}

function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile
      <span className="ml-1.5 text-[11px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
    </Link>
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
