import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { posturesFromTrace } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { PostureLabel, PostureReading } from "@/lib/interview/types";
import { accentHex, getTribeBySlug, statusLabels, type Tribe } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result (slice 4, issue #17; Posture added slice 6, issue #20): the
 * Primary — or honest Co-Primaries when the top tribes never separated
 * (ADR-0006) — plus the dynamic Contender band, each with its display percentage
 * (ADR-0002) and its Posture / arc position (ADR-0004), and the full twelve
 * below. A disqualified- or warning-tribe Primary is framed with non-condemning,
 * arc-aware copy (ADR-0007).
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 * This is a server component: it reads the authoritative Session and the
 * `server-only` scoring engine, so no scoring state reaches the client.
 */

/** Short arc-position label for a tribe's Posture reading (ADR-0004). */
const POSTURE_DISPLAY: Record<PostureLabel, string> = {
  integrated: "Integrated",
  "active-shadow": "Active shadow",
  mixed: "Mixed arc",
  unknown: "",
};

/**
 * Non-condemning, arc-aware framing for a non-`active` Primary (ADR-0007): the
 * `status` names a pattern, Posture decides whether it reads as a caution
 * (active-shadow) or as the arc already completing (integrated). Neither reads
 * as a verdict on the person — the way through is always the tribe's oil.
 */
function arcFraming(
  tribe: Tribe,
  reading: PostureReading | undefined,
): { kicker: string; body: string } {
  const status = statusLabels[tribe.status].toLowerCase();
  const kicker = statusLabels[tribe.status];

  if (reading?.label === "integrated") {
    return {
      kicker: `${kicker} — read as redemption`,
      body:
        `${tribe.name}'s story in Scripture carries a ${status}, but the Interview heard ` +
        `you living this wiring toward its oil, not its fall. Read your result as the arc ` +
        `completing: ${tribe.oil}`,
    };
  }
  if (reading?.label === "active-shadow") {
    return {
      kicker: `${kicker} — read with care`,
      body:
        `${tribe.name}'s wiring is real in you, and the Interview heard it nearer its fall ` +
        `line than its oil. That is a caution, not a condemnation — the ${status} names a ` +
        `pattern to move out of, never a sentence on who you are. The way through is its ` +
        `oil: ${tribe.oil}`,
    };
  }
  return {
    kicker,
    body:
      `${tribe.name} carries a ${status} in Scripture — a pattern named as a warning, never ` +
      `a condemnation of the wiring itself. Its oil is the arc it is meant to complete: ${tribe.oil}`,
  };
}

export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  // Sessions completed before slice 4 hold a legacy stub result; derive the
  // reading from their profile and trace instead (the trace carries Posture).
  const result = Array.isArray(session.result?.primary)
    ? session.result
    : summarize(session.profile, session.trace);
  const pct = result.percentages;
  // Posture is absent on results persisted before slice 6, but their score trace
  // still carries the posture signals — recompute from it so older completed
  // sessions keep their arc readings (ADR-0004).
  const posture = result.posture ?? posturesFromTrace(session.trace);
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const framedPrimaries = result.primary
    .map((slug) => getTribeBySlug(slug))
    .filter((tribe): tribe is Tribe => tribe !== undefined && tribe.status !== "active")
    .map((tribe) => ({ tribe, ...arcFraming(tribe, posture[tribe.slug]) }));
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));
  const ranked = Object.entries(pct)
    .map(([slug, value]) => ({ slug, value }))
    .sort((a, b) => b.value - a.value);
  const top = ranked[0]?.value ?? 0;

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 rounded-[2px] border border-gold/40 bg-gold/5 p-8">
          <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Interview complete
          </div>
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
            {primaryNames.length === 0
              ? "No clear tribe emerged"
              : result.coPrimary
                ? `Co-Primary: ${primaryNames.join(" & ")}`
                : `Primary: ${primaryNames[0]}`}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            Scored from your {session.turnCount}{" "}
            {session.turnCount === 1 ? "answer" : "answers"} against the Marker
            Catalog.{" "}
            {result.coPrimary
              ? "Your top tribes stayed inseparable to the end, so the Interview reports them together rather than forcing a single winner."
              : "Each share reflects how strongly your words resonated with a tribe’s signals."}
          </p>
        </div>

        {framedPrimaries.length > 0 && (
          <section className="mt-10 flex flex-col gap-4">
            {framedPrimaries.map(({ tribe, kicker, body }) => (
              <div
                key={tribe.slug}
                className="rounded-[2px] border border-hair bg-white/50 p-6"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  {kicker}
                </div>
                <p className="mt-2 text-[15px] leading-[1.6] text-ink/90">{body}</p>
              </div>
            ))}
          </section>
        )}

        {result.contenders.length > 0 && (
          <section className="mt-12">
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              {otherContenders.length > 0 ? "Primary & contenders" : "Primary"}
            </p>
            <ul className="mt-6 flex flex-col gap-4">
              {result.contenders.map((slug) => {
                const tribe = getTribeBySlug(slug);
                const isPrimary = result.primary.includes(slug);
                const postureLabel = POSTURE_DISPLAY[posture[slug]?.label ?? "unknown"];
                return (
                  <li
                    key={slug}
                    className="flex items-baseline justify-between gap-4 border-b border-hair pb-3"
                  >
                    <Link
                      href={`/tribes/${slug}`}
                      className="font-serif text-[22px] transition-colors hover:text-gold"
                    >
                      {tribe?.name ?? slug}
                      <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-faint">
                        {isPrimary ? (result.coPrimary ? "Co-Primary" : "Primary") : "Contender"}
                      </span>
                    </Link>
                    <span className="flex items-baseline gap-3">
                      {postureLabel && (
                        <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
                          {postureLabel}
                        </span>
                      )}
                      <span className="text-[15px] tabular-nums text-muted">
                        {Math.round(pct[slug] ?? 0)}%
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mt-12 border-t border-hair pt-8">
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </p>
          <ul className="mt-6 flex flex-col gap-3.5">
            {ranked.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const width = top > 0 ? (row.value / top) * 100 : 0;
              return (
                <li key={row.slug} className="flex items-center gap-4">
                  <span className="w-[108px] shrink-0 font-serif text-[16px]">
                    {tribe?.name ?? row.slug}
                  </span>
                  <span className="relative h-[8px] flex-1 overflow-hidden rounded-full bg-hair/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${width}%`, backgroundColor: accent }}
                    />
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                    {Math.round(row.value)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page, so the start screen is
          unreachable. This starts a fresh Session (overwriting the cookie) so
          the participant can go again.
        */}
        <form action={startInterview} className="mt-10">
          <button
            type="submit"
            className="rounded-[2px] bg-ink px-[34px] py-[14px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Start a new interview
          </button>
        </form>
      </div>
    </main>
  );
}
