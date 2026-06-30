import Link from "next/link";
import { redirect } from "next/navigation";
import type { Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { score } from "@/lib/assessment/score";
import { rankedBars, resolveHeadline, type TribeBar } from "@/lib/assessment/result";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The enriched view (#6): the headline Primary (and Secondary when one qualifies),
 * the full 12-tribe ranking as proportional bars, the words the Subject picked,
 * and prominent links into the full tribe profile(s). It reads only the saved
 * `words` + result and recomputes the scores on the server, so it renders
 * identically right after submitting and when the Subject returns to it later.
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
  // Scoring (and the word→tribe mapping) stays on the server; only the ranked
  // numbers cross into the rendered markup.
  const bars = rankedBars(score(row.words), row.primarySlug, row.secondarySlug);
  const words = [...row.words].sort((a, b) => a.localeCompare(b));

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

        {/* Full 12-tribe ranking — why this result came out the way it did. */}
        <section className="mt-16 border-t border-hair pt-10">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </p>
          <div className="mt-7 flex flex-col gap-3.5">
            {bars.map((bar) => (
              <RankingBar key={bar.slug} bar={bar} />
            ))}
          </div>
        </section>

        {/* The Subject's own selections, so they can connect choices to outcome. */}
        <section className="mt-14 border-t border-hair pt-10">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The {words.length} words you picked
          </p>
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

/** One row of the 12-tribe ranking: name, proportional accent bar, percentage. */
function RankingBar({ bar }: { bar: TribeBar }) {
  const accent = accentHex(bar.color);
  const percent = Math.round(bar.score * 100);
  const emphasized = bar.isPrimary || bar.isSecondary;

  return (
    <div
      className="grid grid-cols-[120px_1fr_auto] items-center gap-4"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={
            emphasized
              ? "font-serif text-[16px] font-semibold text-ink"
              : "font-serif text-[16px] text-muted"
          }
          style={emphasized ? { color: "var(--accent)" } : undefined}
        >
          {bar.name}
        </span>
        {bar.isPrimary && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
            1st
          </span>
        )}
        {bar.isSecondary && (
          <span className="text-[10px] uppercase tracking-[0.14em] text-faint">
            2nd
          </span>
        )}
      </div>
      <div className="h-[8px] overflow-hidden rounded-[2px] bg-hair">
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${percent}%`,
            backgroundColor: "var(--accent)",
            opacity: emphasized ? 1 : 0.5,
          }}
        />
      </div>
      <span className="w-[36px] text-right text-[13px] tabular-nums text-muted">
        {percent}%
      </span>
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
