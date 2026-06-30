import Link from "next/link";
import { redirect } from "next/navigation";
import type { Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankProfile } from "@/lib/assessment/profile";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * This is the full result view (issue #6): the headline Primary (and Secondary
 * when one qualifies), the ranked normalized scores for all 12 tribes as bars,
 * the words the Subject picked, and prominent links to the full tribe profile
 * page(s). The submit action redirects here, so the same view is shown both
 * right after submitting and when revisiting the saved result.
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
  // Recomputed from the stored words by the pure scoring core, so the ranking
  // can never drift from the saved Primary/Secondary.
  const ranked = rankProfile(row.words);
  const headlineSlugs = new Set(
    [primary.slug, secondary?.slug].filter(Boolean) as string[],
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

        {/* Prominent links into the full profile page(s). */}
        <div className="mt-12 flex flex-col gap-3">
          <ProfileLink tribe={primary} label="Primary" />
          {secondary && <ProfileLink tribe={secondary} label="Secondary" />}
        </div>

        {/* How every one of the 12 tribes scored, ranked, as proportional bars. */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ol className="mt-6 flex flex-col gap-[14px]">
            {ranked.map(({ tribe, score, barFraction }) => (
              <ScoreBar
                key={tribe.slug}
                tribe={tribe}
                score={score}
                barFraction={barFraction}
                highlighted={headlineSlugs.has(tribe.slug)}
              />
            ))}
          </ol>
        </section>

        {/* The words the Subject picked. */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you picked
            <span className="ml-2 tabular-nums text-hair">·</span>
            <span className="ml-2 normal-case tracking-normal text-muted">
              {row.words.length}
            </span>
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {row.words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair px-[14px] py-[7px] text-[14px] text-ink"
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

/** A prominent link from the result into a tribe's full `/tribes/[slug]` profile. */
function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group flex items-center gap-4 rounded-[2px] border border-hair px-5 py-4 transition-colors hover:border-ink"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className="h-9 w-[3px] rounded-full"
        style={{ backgroundColor: "var(--accent)" }}
      />
      <span className="flex-1">
        <span className="block text-[11px] uppercase tracking-[0.16em] text-faint">
          Read the full {label} profile
        </span>
        <span className="font-serif text-[20px] font-semibold leading-tight">
          {tribe.name}
          <span className="ml-2 font-sans text-[13px] font-normal not-italic text-muted">
            {tribe.callSign}
          </span>
        </span>
      </span>
      <span className="text-[18px] text-hair transition-colors group-hover:text-ink">
        →
      </span>
    </Link>
  );
}

/** One ranked tribe as a labelled, proportional bar. */
function ScoreBar({
  tribe,
  score,
  barFraction,
  highlighted,
}: {
  tribe: Tribe;
  score: number;
  barFraction: number;
  highlighted: boolean;
}) {
  return (
    <li
      className="grid grid-cols-[140px_1fr_42px] items-center gap-4 max-[520px]:grid-cols-[100px_1fr_38px]"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span
        className={`font-serif text-[17px] leading-tight ${
          highlighted ? "font-semibold text-ink" : "text-muted"
        }`}
      >
        {tribe.name}
      </span>
      <span className="h-[10px] w-full overflow-hidden rounded-[2px] bg-hair/50">
        <span
          className="block h-full rounded-[2px]"
          style={{
            width: `${Math.max(barFraction * 100, score > 0 ? 2 : 0)}%`,
            backgroundColor: "var(--accent)",
            opacity: highlighted ? 1 : 0.55,
          }}
        />
      </span>
      <span className="text-right text-[12px] tabular-nums text-faint">
        {Math.round(score * 100)}%
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
