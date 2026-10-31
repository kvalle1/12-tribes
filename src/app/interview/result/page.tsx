import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { posturePosition, postureLabel } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { PostureReading } from "@/lib/interview/types";
import { accentHex, getTribeBySlug, statusLabels, type Tribe } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Non-condemning, arc-aware framing for a Primary tribe that carries a
 * cautionary `status` (ADR-0004/0007). The tribe's wiring is never a verdict on
 * the person: the reading is cautionary when they are living the tribe's
 * active-shadow and a redemption reading when they are living it integrated.
 * `null` for an `active` tribe, which needs no arc caveat.
 */
function arcFraming(tribe: Tribe, reading: PostureReading): string | null {
  if (tribe.status === "active") return null;

  const arc =
    tribe.status === "warning"
      ? "This is a warning tribe: its arc is a caution, not a condemnation, and the point is movement."
      : "This tribe carries a disqualification arc in its history — a severe warning, never a closed door; restoration is always on offer.";

  switch (reading) {
    case "integrated":
      return `${arc} And the Interview read you living it toward its redeemed form — the oil, not the fall line. You're carrying the hard-won maturity this arc exists to point toward.`;
    case "active-shadow":
      return `${arc} The Interview read you nearer the active-shadow edge of the arc right now. That's a direction to watch, not a sentence — the redeemed form of this wiring is the way through.`;
    default:
      return `${arc} Where you sit on the arc didn't resolve cleanly here; read your Primary's full profile for the movement from the fall line toward the oil.`;
  }
}

/**
 * Interview result (slice 4, issue #17; Posture added slice 6, issue #20): the
 * Primary — or honest Co-Primaries when the top tribes never separated
 * (ADR-0006) — plus the dynamic Contender band, each with its display
 * percentage (ADR-0002) and its Posture / arc position (ADR-0004), and the full
 * twelve below. A Primary with a cautionary `status` gets non-condemning,
 * arc-aware framing. The score trace arrives in a later slice.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 * This is a server component: it reads the authoritative Session and the
 * `server-only` scoring engine, so no scoring state reaches the client.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  // Sessions completed before slice 4 hold a legacy stub result; derive the
  // reading from their profile instead.
  const result = Array.isArray(session.result?.primary)
    ? session.result
    : summarize(session.profile);
  const pct = result.percentages;
  // Posture tallies are authoritative Session state (ADR-0004); a pre-slice-6
  // Session has none, which reads as "unknown" for every tribe.
  const posture = session.posture ?? {};
  const readingFor = (slug: string): PostureReading => posturePosition(posture[slug]).reading;
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));
  // Arc-aware framing for any Primary tribe carrying a cautionary status.
  const primaryArcs = result.primary
    .map((slug) => {
      const tribe = getTribeBySlug(slug);
      if (!tribe) return null;
      const note = arcFraming(tribe, readingFor(slug));
      return note ? { tribe, note } : null;
    })
    .filter((x): x is { tribe: Tribe; note: string } => x !== null);
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

        {result.contenders.length > 0 && (
          <section className="mt-12">
            <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
              {otherContenders.length > 0 ? "Primary & contenders" : "Primary"}
            </p>
            <ul className="mt-6 flex flex-col gap-4">
              {result.contenders.map((slug) => {
                const tribe = getTribeBySlug(slug);
                const isPrimary = result.primary.includes(slug);
                const reading = readingFor(slug);
                return (
                  <li
                    key={slug}
                    className="flex items-baseline justify-between gap-4 border-b border-hair pb-3"
                  >
                    <span className="flex flex-col gap-1">
                      <Link
                        href={`/tribes/${slug}`}
                        className="font-serif text-[22px] transition-colors hover:text-gold"
                      >
                        {tribe?.name ?? slug}
                        <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-faint">
                          {isPrimary ? (result.coPrimary ? "Co-Primary" : "Primary") : "Contender"}
                        </span>
                      </Link>
                      {reading !== "unknown" && (
                        <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
                          Posture · {postureLabel(reading)}
                        </span>
                      )}
                    </span>
                    <span className="text-[15px] tabular-nums text-muted">
                      {Math.round(pct[slug] ?? 0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {primaryArcs.length > 0 && (
          <section className="mt-12">
            {primaryArcs.map(({ tribe, note }) => (
              <div
                key={tribe.slug}
                className="mt-4 rounded-[2px] border border-hair bg-ink/[0.02] p-6 first:mt-0"
              >
                <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                  {tribe.name} · {statusLabels[tribe.status]}
                </div>
                <p className="mt-3 text-[15px] leading-[1.6] text-muted">{note}</p>
              </div>
            ))}
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
