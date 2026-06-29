import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { tribes } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/ranking";

/**
 * The full Self Assessment result view (issue #6). Presentational and free of
 * scoring or persistence — it takes already-resolved tribes, the ranked 12-tribe
 * scores, and the Subject's words — so it renders identically whether shown right
 * after submitting or when a Subject revisits their saved result, and so the
 * profile page (#18) can reuse it unchanged. The word→tribe mapping never reaches
 * here (and therefore never the client): the page computes the ranking on the
 * server and passes only the numbers.
 *
 * Shows the headline (Primary, plus Secondary when one qualifies), every tribe's
 * normalized score as a ranked bar, the words the Subject picked, and prominent
 * links into the full `/tribes/[slug]` profiles — all in the sanctuary palette
 * with each tribe's own accent color.
 */
export interface AssessmentResultViewProps {
  primary: Tribe;
  secondary?: Tribe;
  ranked: RankedTribe[];
  words: readonly string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function AssessmentResultView({
  primary,
  secondary,
  ranked,
  words,
}: AssessmentResultViewProps) {
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

        <ProfileLinks primary={primary} secondary={secondary} />

        <TribeRanking ranked={ranked} />

        <SelectedWords words={words} />

        <div className="mt-14 border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="inline-block rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
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

/** Prominent links into the full profile page(s) for the Primary (and Secondary). */
function ProfileLinks({
  primary,
  secondary,
}: {
  primary: Tribe;
  secondary?: Tribe;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-[22px] gap-y-3">
      <Link
        href={`/tribes/${primary.slug}`}
        className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Read the full {primary.name} profile →
      </Link>
      {secondary && (
        <Link
          href={`/tribes/${secondary.slug}`}
          className="border-b border-hair pb-1 text-[13px] tracking-[0.08em] text-muted transition-colors hover:border-gold hover:text-gold"
        >
          Read the full {secondary.name} profile →
        </Link>
      )}
    </div>
  );
}

/** All 12 tribes, ranked by normalized score, each as a proportional bar. */
function TribeRanking({ ranked }: { ranked: RankedTribe[] }) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </p>
      <ul className="mt-6 flex flex-col gap-[14px]">
        {ranked.map((row) => {
          const tribe = tribeBySlug.get(row.slug);
          const accent = accentHex(tribe?.color ?? "");
          const emphasized = row.isPrimary || row.isSecondary;
          return (
            <li
              key={row.slug}
              className="flex items-center gap-4"
              style={{ "--accent": accent } as React.CSSProperties}
            >
              <span
                className={`w-[88px] shrink-0 truncate font-serif text-[18px] leading-tight ${
                  emphasized ? "font-semibold" : "text-muted"
                }`}
                style={emphasized ? { color: "var(--accent)" } : undefined}
              >
                {row.name}
              </span>
              <span
                className="h-[10px] flex-1 overflow-hidden rounded-[2px] bg-stone"
                role="presentation"
              >
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${Math.round(row.barFraction * 100)}%`,
                    backgroundColor: "var(--accent)",
                    opacity: emphasized ? 1 : 0.55,
                  }}
                />
              </span>
              <span className="w-[42px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                {row.percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The words the Subject selected, connecting their choices to the outcome. */
function SelectedWords({ words }: { words: readonly string[] }) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </p>
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
