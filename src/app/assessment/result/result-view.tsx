import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import { rankTribes, resolveHeadline } from "@/lib/assessment/result";

/**
 * The full Self Assessment result view (issue #6, PRD stories 11–13). Renders the
 * Primary (and Secondary when one qualifies) headline, the ranked normalized
 * scores for all 12 tribes as proportional bars, the words the Subject picked,
 * and prominent links into the full tribe profile page(s).
 *
 * It takes only the saved `words` + headline slugs, so it renders identically
 * whether shown right after submitting or when a Subject revisits their saved
 * current result — and the profile page (#18) can reuse it. Scoring runs here on
 * the server (the scoring core is `server-only`); only computed numbers and
 * public tribe names reach the client, never the word→tribe mapping (ADR-0009).
 */
export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: {
  words: string[];
  primarySlug: string;
  secondarySlug: string | null;
}) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranking = rankTribes(score(words), primarySlug, secondarySlug);
  const topScore = ranking[0]?.score ?? 0;

  return (
    <main className="min-h-screen bg-bone text-ink">
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

        {/* Prominent links into the full profile page(s) (PRD story 13). */}
        <div className="mt-12 flex flex-col gap-3 border-t border-hair pt-8">
          <ProfileLink tribe={primary} label="Primary" />
          {secondary && <ProfileLink tribe={secondary} label="Secondary" />}
        </div>

        {/* Ranked normalized scores for all 12 tribes (PRD story 11). */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <p className="mt-2 text-[14px] leading-[1.5] text-muted">
            Each bar is your normalized strength for that tribe — points you
            earned over the points it was possible to earn — so tribes with more
            or fewer words still compare fairly.
          </p>
          <ol className="mt-7 flex flex-col gap-[14px]">
            {ranking.map(({ tribe, score: value, role }, index) => (
              <ScoreBar
                key={tribe.slug}
                tribe={tribe}
                value={value}
                topScore={topScore}
                role={role}
                rank={index + 1}
              />
            ))}
          </ol>
        </section>

        {/* The words the Subject picked (PRD story 12). */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <div className="mt-5 flex flex-wrap gap-2.5">
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
      className="group flex items-baseline gap-3"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span className="text-[11px] uppercase tracking-[0.18em] text-faint">
        {label}
      </span>
      <span
        className="border-b border-gold pb-0.5 text-[16px] tracking-[0.02em] text-ink transition-colors group-hover:text-gold"
        style={{ borderColor: "var(--accent)" }}
      >
        Read the full {tribe.name} profile →
      </span>
    </Link>
  );
}

function ScoreBar({
  tribe,
  value,
  topScore,
  role,
  rank,
}: {
  tribe: Tribe;
  value: number;
  topScore: number;
  role: "primary" | "secondary" | null;
  rank: number;
}) {
  // Bar width is relative to the leader so the ranking reads clearly; the figure
  // on the right is the raw normalized score on a 0–100 scale.
  const width = topScore > 0 ? (value / topScore) * 100 : 0;
  const isHeadline = role !== null;

  return (
    <li
      className="grid grid-cols-[18px_138px_1fr_28px] items-center gap-x-3"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span className="text-[11px] tabular-nums text-faint">{rank}</span>
      <span
        className={
          isHeadline
            ? "text-[15px] font-medium text-ink"
            : "text-[15px] text-muted"
        }
      >
        {tribe.name}
        {role && (
          <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-faint">
            {role}
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
            width: `${width}%`,
            backgroundColor: "var(--accent)",
            opacity: isHeadline ? 1 : 0.55,
          }}
        />
      </span>
      <span className="text-right text-[12px] tabular-nums text-faint">
        {Math.round(value * 100)}
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
