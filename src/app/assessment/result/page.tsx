import Link from "next/link";
import { redirect } from "next/navigation";
import { tribes, type Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankForDisplay, score } from "@/lib/assessment/score";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view (issue #6): the headline Primary (and Secondary when one
 * qualifies), the ranked normalized scores for all twelve tribes as proportional
 * bars, the words the Subject chose, and prominent links into the full tribe
 * profile page(s). Scoring runs here on the server from the stored words, so the
 * word→tribe mapping never reaches the client (ADR-0009).
 *
 * This is the single rendering path for the result, so it looks identical whether
 * reached right after submitting or revisited later from the home page (#18).
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

  const ranked = rankForDisplay(score(row.words));
  const chosenWords = [...row.words].sort((a, b) => a.localeCompare(b));

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

        {/* Prominent links into the full profile page(s) */}
        <div className="mt-12 flex flex-col gap-3 border-t border-hair pt-8">
          <ProfileLink tribe={primary} label="primary" />
          {secondary && <ProfileLink tribe={secondary} label="secondary" />}
        </div>

        {/* The ranked normalized scores for all twelve tribes */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Every tribe scored against your words, ranked highest first. Longer
            bars mean a closer fit.
          </p>
          <ol className="mt-7 flex flex-col gap-[18px]">
            {ranked.map((entry) => (
              <ScoreBar
                key={entry.slug}
                name={entry.name}
                accent={accentHex(colorBySlug.get(entry.slug) ?? "")}
                barFraction={entry.barFraction}
                scoreValue={entry.score}
                emphasized={
                  entry.slug === primary.slug || entry.slug === secondary?.slug
                }
              />
            ))}
          </ol>
        </section>

        {/* The words the Subject chose */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            {chosenWords.length} words shaped this result.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-3 gap-y-3">
            {chosenWords.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair bg-stone/40 px-[14px] py-[7px] text-[13px] tracking-[0.02em] text-ink"
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
      className="group flex items-baseline gap-2 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <span className="border-b border-gold pb-1 group-hover:border-current">
        Read the full {tribe.name} profile →
      </span>
    </Link>
  );
}

function ScoreBar({
  name,
  accent,
  barFraction,
  scoreValue,
  emphasized,
}: {
  name: string;
  accent: string;
  barFraction: number;
  scoreValue: number;
  emphasized: boolean;
}) {
  // Keep a sliver visible even at a true zero so every tribe reads as present.
  const widthPct = Math.max(barFraction * 100, 1.5);
  return (
    <li style={{ "--accent": accent } as React.CSSProperties}>
      <div className="flex items-baseline justify-between">
        <span
          className={`font-serif text-[19px] leading-tight ${
            emphasized ? "font-semibold text-ink" : "font-normal text-muted"
          }`}
        >
          {name}
        </span>
        <span className="text-[12px] tabular-nums text-faint">
          {Math.round(scoreValue * 100)}%
        </span>
      </div>
      <div className="mt-2 h-[7px] w-full overflow-hidden rounded-full bg-stone">
        <div
          className="h-full rounded-full"
          style={{
            width: `${widthPct}%`,
            backgroundColor: "var(--accent)",
            opacity: emphasized ? 1 : 0.55,
          }}
        />
      </div>
    </li>
  );
}

/** slug → Tailwind color name, for resolving each ranked tribe's accent. */
const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));

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
