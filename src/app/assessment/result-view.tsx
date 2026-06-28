import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type {
  RankedTribe,
  ResultView as ResultViewModel,
} from "@/lib/assessment/result";
import { cn } from "@/lib/utils";

/**
 * The enriched result view (#6): the Primary (and qualifying Secondary) headline,
 * all 12 tribes ranked with proportional bars, the words the Subject picked, and
 * prominent links into the full tribe profiles. Presentation only — it takes a
 * pre-computed `ResultViewModel` (built server-side from the saved result) and
 * holds no scoring or word→tribe data, so the same view renders identically
 * post-submit, on a revisit, and (later) on the profile page (#18).
 */
export function ResultView({ view }: { view: ResultViewModel }) {
  const { primary, secondary, ranking, words } = view;

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

      {/* Prominent links into the full profile write-up(s). */}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
      </div>

      {/* The full 12-tribe ranking — why this result came out the way it did. */}
      <section className="mt-16">
        <h2 className="border-b border-hair pb-2 font-serif text-[22px] font-semibold">
          How every tribe scored
        </h2>
        <ol className="mt-5 space-y-1">
          {ranking.map((row) => (
            <RankRow key={row.tribe.slug} row={row} />
          ))}
        </ol>
      </section>

      {/* The Subject's own selections — connecting their choices to the outcome. */}
      <section className="mt-16">
        <h2 className="border-b border-hair pb-2 font-serif text-[22px] font-semibold">
          The words you chose
        </h2>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {words.map((word) => (
            <span
              key={word}
              className="rounded-[2px] border border-gold/40 bg-gold/5 px-4 py-2 text-[15px] text-ink"
            >
              {word}
            </span>
          ))}
        </div>
      </section>

      <div className="mt-16 border-t border-hair pt-8">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Retake the assessment
        </Link>
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

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile →
    </Link>
  );
}

function RankRow({ row }: { row: RankedTribe }) {
  const { tribe, widthPct, isPrimary, isSecondary } = row;
  const highlighted = isPrimary || isSecondary;

  return (
    <li
      className="grid grid-cols-[110px_1fr_42px] items-center gap-3 py-1.5 max-[520px]:grid-cols-[90px_1fr_38px]"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-1.5 truncate">
        <span
          className={cn(
            "font-serif text-[17px] leading-none",
            highlighted ? "font-semibold text-ink" : "text-muted",
          )}
        >
          {tribe.name}
        </span>
        {isPrimary && <RankTag>1st</RankTag>}
        {isSecondary && <RankTag>2nd</RankTag>}
      </div>

      <div className="h-[10px] overflow-hidden rounded-[2px] bg-stone">
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{
            width: `${widthPct}%`,
            background: "var(--accent)",
            opacity: highlighted ? 1 : 0.5,
          }}
        />
      </div>

      <span className="text-right text-[12px] tabular-nums text-faint">
        {Math.round(widthPct)}%
      </span>
    </li>
  );
}

function RankTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-[0.14em] text-gold">
      {children}
    </span>
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
