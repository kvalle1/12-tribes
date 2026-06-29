import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type {
  ResultView as ResultViewModel,
  TribeBar,
} from "@/lib/assessment/result-view";

/**
 * The enriched result view (issue #6): the headline, the ranked 12-tribe bars,
 * the words the Subject chose, and prominent links into the full tribe
 * profile(s). Presentational only — it takes a fully-built view-model so the
 * same component renders identically post-submit, on a revisit, and (via #18)
 * on the profile page.
 */
export function ResultView({ view }: { view: ResultViewModel }) {
  const { primary, secondary, bars, words } = view;

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

        {/* Ranked 12-tribe bars */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </h2>
          <div className="mt-6 flex flex-col gap-[14px]">
            {bars.map((bar) => (
              <ScoreBar key={bar.tribe.slug} bar={bar} />
            ))}
          </div>
        </section>

        {/* The words you chose */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair px-[13px] py-[7px] font-serif text-[15px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        {/* Profile links + retake */}
        <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
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
      </div>
    </main>
  );
}

function ScoreBar({ bar }: { bar: TribeBar }) {
  const accent = accentHex(bar.tribe.color);
  const emphasized = bar.isPrimary || bar.isSecondary;

  return (
    <div
      className="grid grid-cols-[140px_1fr_44px] items-center gap-3 max-[480px]:grid-cols-[96px_1fr_40px]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span
          className={`truncate font-serif text-[17px] leading-tight ${
            emphasized ? "font-semibold text-ink" : "text-muted"
          }`}
        >
          {bar.tribe.name}
        </span>
        {bar.isPrimary && (
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Primary
          </span>
        )}
        {bar.isSecondary && (
          <span className="text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Second
          </span>
        )}
      </div>

      <div className="h-[8px] w-full overflow-hidden rounded-[2px] bg-hair/40">
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{
            width: `${bar.fill * 100}%`,
            backgroundColor: "var(--accent)",
            opacity: emphasized ? 1 : 0.5,
          }}
        />
      </div>

      <span
        className={`text-right text-[13px] tabular-nums ${
          emphasized ? "text-ink" : "text-faint"
        }`}
      >
        {bar.percent}%
      </span>
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
