import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankForDisplay } from "@/lib/assessment/ranking";

/**
 * The full result view (#6), shown identically right after submitting and when a
 * Subject returns to their saved current result, and reused by the profile page
 * (#18). Presentational only: it takes an already-computed Strength Profile and
 * renders the headline, the 12-tribe ranked bars, the Subject's selected words,
 * and the prominent links into the full tribe profiles. It never touches the
 * word→tribe mapping or the DB, so it is safe to render anywhere.
 */
export interface ResultViewProps {
  /** The headline tribes resolved from the saved result. */
  primary: Tribe;
  secondary?: Tribe;
  /** Normalized 0–1 score for every tribe, in canonical order. */
  scores: TribeScore[];
  /** The exact words the Subject selected. */
  words: string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ primary, secondary, scores, words }: ResultViewProps) {
  const ranked = rankForDisplay(scores);

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

        {/* Profile links — prominent path into the deeper write-up(s). */}
        <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-hair pt-8">
          <ProfileLink tribe={primary} label="Read the full" />
          {secondary && <ProfileLink tribe={secondary} label="And the" />}
        </div>

        {/* The full Strength Profile — all 12 tribes, ranked, so the Subject sees why. */}
        <section className="mt-16">
          <h2 className="font-serif text-[26px] font-semibold">How every tribe scored</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            Your normalized fit for all twelve, ranked — this is the shape behind your result.
          </p>
          <ol className="mt-7 flex flex-col gap-[14px]">
            {ranked.map((row, i) => {
              const tribe = tribeBySlug.get(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              return (
                <li
                  key={row.slug}
                  className="grid grid-cols-[20px_minmax(96px,150px)_1fr_44px] items-center gap-3"
                  style={{ "--accent": accent } as React.CSSProperties}
                >
                  <span className="text-[11px] text-faint tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/tribes/${row.slug}`}
                    className="truncate font-serif text-[17px] leading-tight transition-colors hover:text-gold"
                  >
                    {row.name}
                  </Link>
                  <div
                    className="h-[10px] overflow-hidden rounded-[2px] bg-stone"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-[2px]"
                      style={{
                        width: `${row.widthPct}%`,
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="text-right text-[12px] text-muted tabular-nums">
                    {row.percent}%
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The words the Subject picked — connect choices to outcome. */}
        <section className="mt-16">
          <h2 className="font-serif text-[26px] font-semibold">The words you chose</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            {words.length} {words.length === 1 ? "word" : "words"} — the raw material of your result.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-2.5 gap-y-2.5">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair bg-stone/40 px-3 py-1.5 text-[13px] tracking-[0.01em] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
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
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      {label} {tribe.name} profile →
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
