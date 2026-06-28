import Link from "next/link";
import { redirect } from "next/navigation";
import type { Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { accentHex, buildRanking, type RankedTribe } from "@/lib/assessment/ranking";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * The full result view (issue #6): the headline Primary (and Secondary when one
 * qualifies), the ranked normalized scores for all 12 tribes as bars, the words
 * the Subject picked, and prominent links into the full tribe profile pages. The
 * 12-tribe ranking is recomputed on the server from the stored `words` by the
 * pure scoring core, so the word→tribe mapping never reaches the client and the
 * ranking can't drift from the saved selection. This same page is shown both
 * right after submitting (the action redirects here) and when a Subject returns
 * to their saved result, so the two render identically.
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
  const ranking = buildRanking(row.words, row.primarySlug, row.secondarySlug);

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

        {/* Ranked scores for all 12 tribes — the "why" behind the headline. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ul className="mt-7 flex flex-col gap-[18px]">
            {ranking.map((tribe) => (
              <RankRow key={tribe.slug} tribe={tribe} />
            ))}
          </ul>
        </section>

        {/* The words the Subject chose. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {row.words.map((word) => (
              <li
                key={word}
                className="rounded-full border border-hair px-[14px] py-[6px] text-[13px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        {/* Prominent links into the full tribe profile(s) + retake. */}
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

/** A single ranked tribe: name + badge, a proportional accent bar, and percent. */
function RankRow({ tribe }: { tribe: RankedTribe }) {
  return (
    <li
      style={{ "--accent": tribe.accent } as React.CSSProperties}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-[7px]"
    >
      <div className="flex items-baseline gap-[10px]">
        <Link
          href={`/tribes/${tribe.slug}`}
          className="font-serif text-[19px] leading-none transition-colors hover:text-gold"
          style={tribe.badge ? { color: "var(--accent)" } : undefined}
        >
          {tribe.name}
        </Link>
        {tribe.badge && (
          <span className="text-[10px] uppercase tracking-[0.16em] text-faint">
            {tribe.badge}
          </span>
        )}
      </div>
      <span className="justify-self-end text-[12px] tabular-nums text-muted">
        {tribe.percent}%
      </span>
      {/* Bar track spanning both columns, fill proportional to the top score. */}
      <div className="col-span-2 h-[6px] overflow-hidden rounded-full bg-stone">
        <div
          className="h-full rounded-full"
          style={{
            width: `${tribe.barFraction * 100}%`,
            backgroundColor: "var(--accent)",
          }}
        />
      </div>
    </li>
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
