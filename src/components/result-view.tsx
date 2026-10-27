import Link from "next/link";
import { accentHex, getTribeBySlug, type Tribe } from "@/lib/tribes";
import { rankScores } from "@/lib/assessment/ranking";
import { score } from "@/lib/assessment/score";

/**
 * The full Self Assessment result view (issue #6): the Primary (and qualifying
 * Secondary) headline, the ranking bars for all twelve tribes, the words the
 * Subject chose, and prominent links into the full tribe profiles.
 *
 * It renders from the stored row's raw fields (`words` + the derived
 * Primary/Secondary slugs) and recomputes the twelve-tribe ranking from `words`
 * via the pure scoring core, so the ranking can never drift from the saved
 * selection. The same component backs both the post-submit result page and the
 * revisit of a saved result (and the profile page in #18), so the view is
 * identical everywhere.
 *
 * This is a server component: it imports the scoring core, which is `server-only`
 * (the word→tribe mapping never reaches the client, ADR-0009). Render it only
 * from server components.
 */
export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: {
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const primary = getTribeBySlug(primarySlug);
  if (!primary) throw new Error(`Unknown primary tribe slug "${primarySlug}"`);
  const secondary = secondarySlug
    ? getTribeBySlug(secondarySlug)
    : undefined;

  const ranked = rankScores(score(words));

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

      {/* Ranking bars — all twelve tribes, so the Subject sees why they got this result. */}
      <section className="mt-16 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How the twelve scored
        </p>
        <ul className="mt-6 flex flex-col gap-3.5">
          {ranked.map((row) => {
            const tribe = getTribeBySlug(row.slug);
            const accent = accentHex(tribe?.color ?? "");
            const role =
              row.slug === primarySlug
                ? "Primary"
                : row.slug === secondarySlug
                  ? "Secondary"
                  : null;
            return (
              <li
                key={row.slug}
                className="grid grid-cols-[120px_1fr] items-center gap-4 max-[520px]:grid-cols-[92px_1fr]"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-serif text-[17px] leading-none"
                    style={{ color: role ? accent : undefined }}
                  >
                    {row.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-hair/50"
                    role="img"
                    aria-label={`${row.name}: ${Math.round(row.relative * 100)}% of the top score`}
                  >
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${Math.max(row.relative * 100, row.score > 0 ? 3 : 0)}%`,
                        backgroundColor: accent,
                        opacity: role ? 1 : 0.55,
                      }}
                    />
                  </div>
                  {role && (
                    <span className="w-[68px] shrink-0 text-right text-[10px] uppercase tracking-[0.14em] text-faint">
                      {role}
                    </span>
                  )}
                  {!role && <span className="w-[68px] shrink-0" aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The words the Subject picked, so they can connect their choices to the outcome. */}
      <section className="mt-14 border-t border-hair pt-8">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[14px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions + prominent profile links for the Primary and Secondary tribes. */}
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
