import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { resolveHeadline } from "@/lib/assessment/result";

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

/**
 * The full result view (#6): the headline Primary (and Secondary when one
 * qualifies), the ranked normalized scores for all 12 tribes as bars, the words
 * the Subject chose, and prominent links into the full tribe profiles.
 *
 * It renders purely from a saved result's stored fields — `words` are re-scored
 * with the pure, client-safe scoring core, so the same component renders
 * identically whether shown right after submitting or when revisiting the saved
 * current result. The profile page (#18) reuses it verbatim.
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
  const ranked = rankScores(score(words));
  const highlighted = new Set(
    [primary.slug, secondary?.slug].filter(Boolean) as string[],
  );

  return (
    <>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your tribe
      </p>

      <TribeHeadline tribe={primary} />
      <ProfileLink tribe={primary} />

      {secondary && (
        <>
          <p className="mt-12 text-[12px] uppercase tracking-[0.2em] text-faint">
            With a strong secondary
          </p>
          <TribeHeadline tribe={secondary} />
          <ProfileLink tribe={secondary} />
        </>
      )}

      {/* Ranked normalized scores for all 12 tribes — the "why" behind the result. */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ol className="mt-7 flex flex-col gap-[14px]">
          {ranked.map((tribe) => (
            <li
              key={tribe.slug}
              style={
                { "--accent": accentForSlug(tribe.slug) } as React.CSSProperties
              }
            >
              <Link
                href={`/tribes/${tribe.slug}`}
                className="group grid grid-cols-[24px_minmax(0,1fr)_46px] items-center gap-4"
              >
                <span className="text-[11px] tabular-nums text-faint">
                  {String(tribe.rank).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-[6px]">
                  <span
                    className={
                      highlighted.has(tribe.slug)
                        ? "font-serif text-[16px] font-semibold text-ink"
                        : "font-serif text-[16px] text-muted transition-colors group-hover:text-ink"
                    }
                  >
                    {tribe.name}
                  </span>
                  <span
                    className="h-[7px] rounded-full bg-hair/60"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(tribe.score * 100, tribe.score > 0 ? 2 : 0)}%`,
                        background: "var(--accent)",
                        opacity: highlighted.has(tribe.slug) ? 1 : 0.55,
                      }}
                    />
                  </span>
                </span>
                <span className="text-right text-[12px] tabular-nums text-muted">
                  {Math.round(tribe.score * 100)}%
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* The words the Subject picked — connecting their choices to the outcome. */}
      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
          <span className="ml-2 text-faint/70">({words.length})</span>
        </h2>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-full border border-hair px-[15px] py-[7px] text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentForSlug(tribe.slug) } as React.CSSProperties}
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

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="mt-4 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile →
    </Link>
  );
}

/** Resolve a tribe's accent hex from its `color` field; brass if the slug is unknown. */
function accentForSlug(slug: string): string {
  const tribe = tribeBySlug.get(slug);
  return tribe ? accentHex(tribe.color) : "#a9842f";
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
