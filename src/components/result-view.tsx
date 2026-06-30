import Link from "next/link";
import type { CSSProperties } from "react";
import { tribes, type Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { toRankedBars, type RankedBar } from "@/lib/assessment/ranking";
import { resolveHeadline } from "@/lib/assessment/result";

/**
 * The enriched Self Assessment result view (issue #6). Shown both right after a
 * Subject submits and whenever they return to their saved current result — it
 * renders from the stored row alone (the selected words plus the Primary /
 * Secondary slugs), so the two paths are identical by construction.
 *
 * Scoring runs here, on the server: `score()` reaches the `server-only`
 * word→tribe mapping, so this stays a server component and only the resulting
 * numbers cross to the client (ADR-0009 trust boundary). The richer slices —
 * the profile page (#18) — reuse this component as-is.
 */
export interface ResultViewProps {
  /** The words the Subject selected, exactly as saved. */
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

const tribeBySlug = new Map(tribes.map((tribe) => [tribe.slug, tribe]));

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const bars = toRankedBars(score(words));

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

      {/* Prominent links into the full profile(s) */}
      <div className="mt-10 flex flex-col gap-3">
        <ProfileLink tribe={primary} label="Read the full" />
        {secondary && <ProfileLink tribe={secondary} label="And the full" />}
      </div>

      {/* All twelve tribes, ranked, so the Subject sees why */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ol className="mt-6 flex flex-col gap-[14px]">
          {bars.map((bar) => (
            <RankingBar
              key={bar.slug}
              bar={bar}
              isPrimary={bar.slug === primary.slug}
              isSecondary={bar.slug === secondary?.slug}
            />
          ))}
        </ol>
      </section>

      {/* The Subject's own words, so they can connect choices to outcome */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </h2>
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
      style={{ "--accent": accentHex(tribe.color) } as CSSProperties}
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

function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group inline-flex items-center gap-2 text-[13px] tracking-[0.08em] text-ink"
    >
      <span className="border-b border-gold pb-1 transition-colors group-hover:text-gold">
        {label} {tribe.name} profile
      </span>
      <span className="text-gold transition-transform group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}

function RankingBar({
  bar,
  isPrimary,
  isSecondary,
}: {
  bar: RankedBar;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const tribe = tribeBySlug.get(bar.slug);
  const accent = accentHex(tribe?.color ?? "");
  const highlighted = isPrimary || isSecondary;

  return (
    <li style={{ "--accent": accent } as CSSProperties}>
      <Link
        href={`/tribes/${bar.slug}`}
        className="group grid grid-cols-[120px_1fr_42px] items-center gap-4 max-[520px]:grid-cols-[92px_1fr_38px]"
      >
        <span
          className={
            highlighted
              ? "font-serif text-[18px] font-semibold leading-tight text-ink"
              : "font-serif text-[18px] leading-tight text-muted transition-colors group-hover:text-ink"
          }
        >
          {bar.name}
          {isPrimary && (
            <span className="ml-1.5 align-middle text-[9px] uppercase tracking-[0.12em] text-gold">
              Primary
            </span>
          )}
          {isSecondary && (
            <span className="ml-1.5 align-middle text-[9px] uppercase tracking-[0.12em] text-gold">
              Secondary
            </span>
          )}
        </span>

        <span className="h-[8px] w-full overflow-hidden rounded-[2px] bg-stone">
          <span
            className="block h-full rounded-[2px]"
            style={{
              width: `${bar.relativeWidth}%`,
              background: "var(--accent)",
              opacity: highlighted ? 1 : 0.55,
            }}
          />
        </span>

        <span className="text-right text-[13px] tabular-nums text-faint">
          {bar.percent}%
        </span>
      </Link>
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
