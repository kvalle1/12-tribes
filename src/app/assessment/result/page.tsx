import Link from "next/link";
import { redirect } from "next/navigation";
import type { Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { buildRanking, resolveHeadline, type RankedTribe } from "@/lib/assessment/result";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view (#6): the headline Primary (and Secondary when one
 * qualifies), the ranked normalized scores for all 12 tribes as bars, the words
 * the Subject picked, and prominent links into the `/tribes/[slug]` profiles.
 * It renders from the saved row alone, so it's identical whether reached right
 * after submitting or when revisiting the saved result later.
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const { primary, secondary } = resolveHeadline(
    row.primarySlug,
    row.secondarySlug,
  );
  // Scoring stays on the server (ADR-0009); the view receives only ranked data.
  const ranking = buildRanking(
    score(row.words),
    row.primarySlug,
    row.secondarySlug,
  );

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

        {/* The full ranking — why this result (PRD story 11). */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ol className="mt-7 flex flex-col gap-3.5">
            {ranking.map((entry) => (
              <RankingBar key={entry.tribe.slug} entry={entry} />
            ))}
          </ol>
        </section>

        {/* The Subject's own words (PRD story 12). */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {row.words.map((word) => (
              <span
                key={word}
                className="rounded-[2px] border border-gold/40 bg-gold/[0.06] px-4 py-2 text-[15px] text-ink"
              >
                {word}
              </span>
            ))}
          </div>
        </section>

        <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-10">
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
              Read the {secondary.name} profile
            </Link>
          )}
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

/**
 * One tribe's ranked bar. The whole row links into the tribe's profile (so the
 * Primary and Secondary — and every other tribe — reach their `/tribes/[slug]`
 * write-up, PRD story 13). The fill is the tribe's accent color, scaled to its
 * share of the top score; the Primary/Secondary carry a small label.
 */
function RankingBar({ entry }: { entry: RankedTribe }) {
  const { tribe, percent, fraction, isPrimary, isSecondary } = entry;
  const accent = accentHex(tribe.color);

  return (
    <li>
      <Link
        href={`/tribes/${tribe.slug}`}
        className="group grid grid-cols-[140px_1fr_44px] items-center gap-4 rounded-[2px] py-1.5 transition-colors max-[520px]:grid-cols-[104px_1fr_40px]"
        style={{ "--accent": accent } as React.CSSProperties}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[19px] leading-none text-ink transition-colors group-hover:text-[color:var(--accent)] max-[520px]:text-[16px]">
            {tribe.name}
          </span>
          {(isPrimary || isSecondary) && (
            <span className="text-[9.5px] uppercase tracking-[0.14em] text-faint">
              {isPrimary ? "Primary" : "Secondary"}
            </span>
          )}
        </div>

        <div
          className="h-2.5 overflow-hidden rounded-full bg-stone"
          role="presentation"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(fraction * 100, fraction > 0 ? 2 : 0)}%`,
              backgroundColor: accent,
              opacity: isPrimary || isSecondary ? 1 : 0.55,
            }}
          />
        </div>

        <span className="text-right text-[13px] tabular-nums text-muted">
          {percent}%
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
