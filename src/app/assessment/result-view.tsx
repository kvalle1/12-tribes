import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type {
  RankedTribeScore,
  ResultViewModel,
} from "@/lib/assessment/view-model";

/**
 * The enriched, presentational result view (issue #6). Given a fully-built
 * view-model, it renders the headline tribe(s), the 12-tribe ranking bars, the
 * words the Subject picked, and prominent links into the full tribe profiles.
 *
 * It takes only plain display data — no DB, no scoring, no word→tribe mapping —
 * so the post-submit result page and the profile page (#18) can share it and it
 * renders identically from either entry point.
 */
export function ResultView({ primary, secondary, ranking, words }: ResultViewModel) {
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

      <RankingBars
        ranking={ranking}
        primarySlug={primary.slug}
        secondarySlug={secondary?.slug}
      />

      <SelectedWords words={words} />

      <ProfileLinks primary={primary} secondary={secondary} />
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

/**
 * Every one of the 12 tribes, ranked by normalized score, as proportional bars —
 * so the Subject can see why they got their result. The Primary (and Secondary)
 * rows are accented to tie back to the headline; the rest read as quiet context.
 */
function RankingBars({
  ranking,
  primarySlug,
  secondarySlug,
}: {
  ranking: RankedTribeScore[];
  primarySlug: string;
  secondarySlug?: string;
}) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </p>
      <ul className="mt-6 flex flex-col gap-3.5">
        {ranking.map((row) => {
          const highlighted =
            row.slug === primarySlug || row.slug === secondarySlug;
          return (
            <li key={row.slug} className="grid grid-cols-[110px_1fr_44px] items-center gap-4">
              <span
                className={
                  highlighted
                    ? "font-serif text-[17px] text-ink"
                    : "font-serif text-[17px] text-muted"
                }
              >
                {row.name}
              </span>
              <span
                className="relative block h-[8px] rounded-[2px] bg-stone"
                aria-hidden="true"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-[2px]"
                  style={{
                    width: `${Math.max(row.fraction * 100, row.score > 0 ? 3 : 0)}%`,
                    background: highlighted ? accentHex(row.color) : "var(--hair)",
                  }}
                />
              </span>
              <span className="text-right text-[12px] tabular-nums text-faint">
                {Math.round(row.score * 100)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The words the Subject picked, so they can connect their choices to the outcome. */
function SelectedWords({ words }: { words: string[] }) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {words.map((word) => (
          <span
            key={word}
            className="rounded-[2px] border border-gold bg-gold/10 px-4 py-2 text-[15px] text-ink"
          >
            {word}
          </span>
        ))}
      </div>
    </section>
  );
}

/** Prominent links into the full `/tribes/[slug]` write-up(s) for the result tribes. */
function ProfileLinks({
  primary,
  secondary,
}: {
  primary: Tribe;
  secondary?: Tribe;
}) {
  return (
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
