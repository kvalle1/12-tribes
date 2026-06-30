import Link from "next/link";
import { redirect } from "next/navigation";
import type { Tribe } from "@/lib/tribes";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankWords, type RankedTribe } from "@/lib/assessment/ranking";

/**
 * The Subject's saved current result (ADR-0004). Login-gated; an unauthenticated
 * visitor is routed through sign-in, and a signed-in user who hasn't taken the
 * assessment is sent to start it.
 *
 * This is the full result view (issue #6): the Primary (and Secondary when one
 * qualifies) headline, the ranked normalized scores for all 12 tribes as bars,
 * the words the Subject picked, and prominent links into the full tribe
 * profile(s). It renders the same whether reached right after submitting or by
 * revisiting the saved result, because both land here and the ranking is
 * recomputed from the stored `words` (the single source of truth, ADR-0001).
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
  const ranked = rankWords(row.words);

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

        {/* Prominent links into the full profile(s). */}
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
          <ProfileLink tribe={primary} />
          {secondary && <ProfileLink tribe={secondary} />}
        </div>

        {/* The full 12-tribe ranking, so the Subject sees why they got their result. */}
        <section className="mt-16">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </p>
          <div className="mt-6 flex flex-col gap-[14px]">
            {ranked.map((entry) => (
              <TribeBar
                key={entry.tribe.slug}
                entry={entry}
                isPrimary={entry.tribe.slug === primary.slug}
                isSecondary={entry.tribe.slug === secondary?.slug}
              />
            ))}
          </div>
        </section>

        {/* The words the Subject picked. */}
        <section className="mt-16">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </p>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {row.words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair bg-stone/40 px-[14px] py-[7px] text-[13px] tracking-[0.02em] text-ink"
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
        <Link href={`/tribes/${tribe.slug}`} className="hover:underline">
          <span style={{ color: "var(--accent)" }}>{tribe.name}</span>
        </Link>
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

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="group inline-flex items-center gap-2 text-[13px] tracking-[0.06em] text-ink"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <span className="border-b border-gold pb-0.5 transition-colors group-hover:text-gold">
        Read the {tribe.name} profile
      </span>
      <span
        className="transition-transform group-hover:translate-x-1"
        style={{ color: "var(--accent)" }}
        aria-hidden="true"
      >
        →
      </span>
    </Link>
  );
}

/** One ranked tribe row: name, a proportional accent bar, and its normalized %. */
function TribeBar({
  entry,
  isPrimary,
  isSecondary,
}: {
  entry: RankedTribe;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const { tribe, score, fraction } = entry;
  const percent = Math.round(score * 100);
  const label = isPrimary ? "Primary" : isSecondary ? "Secondary" : null;

  return (
    <div
      className="grid grid-cols-[120px_1fr_42px] items-center gap-x-4 max-[520px]:grid-cols-[92px_1fr_38px]"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <Link
        href={`/tribes/${tribe.slug}`}
        className="truncate font-serif text-[17px] leading-tight text-ink transition-colors hover:text-gold"
      >
        {tribe.name}
        {label && (
          <span className="ml-1.5 align-middle text-[9px] uppercase tracking-[0.14em] text-faint">
            {label}
          </span>
        )}
      </Link>
      <div className="h-[10px] rounded-[2px] bg-stone">
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${Math.max(fraction * 100, score > 0 ? 2 : 0)}%`,
            background: "var(--accent)",
            opacity: isPrimary || isSecondary ? 1 : 0.62,
          }}
        />
      </div>
      <span className="text-right text-[12px] tabular-nums text-muted">
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
