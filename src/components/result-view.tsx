import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/ranking";

/**
 * The full Self Assessment result view (issue #6): the headline tribe(s), the
 * ranked 12-tribe bars, the words the Subject picked, and links into the full
 * tribe profiles. Pure presentation — it receives the already-computed ranking
 * and resolved tribes, so it renders identically whether shown right after
 * submitting or when the Subject revisits their saved result, and it can be
 * reused by the profile page (issue #18) without re-running scoring on the
 * client. The word→tribe mapping never reaches here, only the scored output.
 */
export function ResultView({
  primary,
  secondary,
  ranked,
  words,
}: {
  primary: Tribe;
  secondary?: Tribe;
  ranked: RankedTribe[];
  words: readonly string[];
}) {
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

      {/* Why you got this — the normalized score for every tribe, ranked. */}
      <section className="mt-16">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((tribe) => (
            <li
              key={tribe.slug}
              style={
                { "--accent": accentHex(tribe.color) } as React.CSSProperties
              }
            >
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="font-serif text-[18px] text-ink">
                  {tribe.name}
                </span>
                <span className="text-[12px] tabular-nums text-muted">
                  {Math.round(tribe.percent)}%
                </span>
              </div>
              <div className="mt-1.5 h-[6px] overflow-hidden rounded-[2px] bg-stone">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${tribe.percent}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-16">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair px-3 py-1.5 text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

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
    </>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="mt-4 block transition-opacity hover:opacity-80"
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
