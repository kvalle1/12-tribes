import Link from "next/link";
import { accentHex } from "@/lib/accent";
import {
  rankTribes,
  resolveHeadline,
  type RankedTribe,
} from "@/lib/assessment/result";
import type { Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The full Self Assessment result view (issue #6): the Primary (and Secondary
 * when one qualifies) headline, the normalized scores of all twelve tribes as
 * ranked bars, the words the Subject picked, and prominent links into the full
 * tribe profile page(s).
 *
 * Presentational and free of any DB or server-only import, so it renders the
 * same whether shown right after submitting or when a Subject (or the profile
 * page, #18) revisits their saved current result — the page above it does the
 * loading and scoring and hands this component a serializable view model.
 */
export interface ResultViewProps {
  /** Normalized 0–1 score for every tribe (canonical order), from the scoring core. */
  scores: TribeScore[];
  primarySlug: string;
  secondarySlug?: string | null;
  /** The words the Subject selected, in selection order. */
  words: string[];
  /** Where the "back" link points — the home page by default. */
  backHref?: string;
}

export function ResultView({
  scores,
  primarySlug,
  secondarySlug,
  words,
  backHref = "/",
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankTribes(scores, primarySlug, secondarySlug);
  const leader = ranked[0]?.score ?? 0;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href={backHref}
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

        {/* The 12-tribe ranking — why this result came out the way it did. */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </h2>
          <div className="mt-6 flex flex-col gap-[14px]">
            {ranked.map((r) => (
              <TribeBar key={r.tribe.slug} ranked={r} leader={leader} />
            ))}
          </div>
        </section>

        {/* The words the Subject picked — connecting their choices to the outcome. */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair px-[14px] py-[6px] font-serif text-[16px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        {/* Prominent links into the full profile write-up(s). */}
        <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
          <ProfileLink tribe={primary} />
          {secondary && <ProfileLink tribe={secondary} />}
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
        <Link
          href={`/tribes/${tribe.slug}`}
          className="transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          {tribe.name}
        </Link>
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
 * One ranked bar. Width is the tribe's normalized score relative to the leader,
 * so the strongest tribe fills the track and the rest read as a proportion of
 * it; the figure on the right is the true normalized score as a percentage.
 * Primary and Secondary carry their accent color; the rest stay muted brass.
 */
function TribeBar({
  ranked,
  leader,
}: {
  ranked: RankedTribe;
  leader: number;
}) {
  const { tribe, score, isPrimary, isSecondary } = ranked;
  const width = leader > 0 ? (score / leader) * 100 : 0;
  const accent = accentHex(tribe.color);
  const highlighted = isPrimary || isSecondary;

  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group grid grid-cols-[120px_1fr_auto] items-center gap-4 max-[520px]:grid-cols-[88px_1fr_auto]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <span
        className={`font-serif text-[16px] leading-tight ${
          highlighted ? "font-semibold" : "text-muted"
        }`}
        style={highlighted ? { color: "var(--accent)" } : undefined}
      >
        {tribe.name}
        {isPrimary && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            Primary
          </span>
        )}
        {isSecondary && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            Secondary
          </span>
        )}
      </span>

      <span className="block h-[8px] rounded-[2px] bg-stone">
        <span
          className="block h-full rounded-[2px] transition-[width] duration-500"
          style={{
            width: `${width}%`,
            backgroundColor: highlighted ? accent : "var(--hair)",
          }}
        />
      </span>

      <span className="w-[42px] text-right text-[12px] tabular-nums text-faint">
        {Math.round(score * 100)}%
      </span>
    </Link>
  );
}

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile
    </Link>
  );
}
