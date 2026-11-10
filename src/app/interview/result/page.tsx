import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { readPosture } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { PostureArc } from "@/lib/interview/types";
import { accentHex, getTribeBySlug, statusLabels, type TribeStatus } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Posture (ADR-0004) surfaced per Primary/Contender: where the participant sits
 * on that tribe's fall→oil arc. A short, neutral tag for the list.
 */
const arcLabel: Record<PostureArc, string> = {
  "active-shadow": "Active-shadow",
  mixed: "Mid-arc",
  integrated: "Integrated",
  unknown: "",
};

/**
 * Arc-aware, non-condemning framing for a non-`active` Primary (ADR-0007): the
 * `status` names the caution, Posture gives it its reading — active-shadow is
 * cautionary, integrated is redemption — and the copy never condemns. `active`
 * tribes need no such framing and are absent here.
 */
const statusNote: Record<Exclude<TribeStatus, "active">, string> = {
  disqualified:
    "This tribe is absent from Revelation 7’s 144,000 — a severe warning, not a permanent verdict. Restoration is on the table (Ezekiel 48); the pattern only has to be named.",
  warning:
    "This is a warning tribe: the call is not to stay here but to move through it, into others.",
  "disqualified-arc":
    "This tribe carries a historical disqualification arc — a severe warning drawn from how its story went, never a sentence on how yours must.",
};

/** The arc-specific reading that leads the framing, before the status note. */
function arcReading(arc: PostureArc): string {
  switch (arc) {
    case "integrated":
      return "Your answers read as having matured along this arc — you carry the wiring and show its oil, not its fall-line. This is the redemption side of the story.";
    case "active-shadow":
      return "Your answers read closer to this tribe’s fall-line than its oil right now. That is a point on an arc, not a verdict — the same wiring is what makes the turn toward its oil possible.";
    case "mixed":
      return "Your answers sit mid-arc — some of the fall-line, some of the oil. Where you settle is still being written.";
    default:
      return "";
  }
}

/**
 * Interview result (slice 4, issue #17): the Primary — or honest Co-Primaries
 * when the top tribes never separated (ADR-0006) — plus the dynamic Contender
 * band, each with its display percentage (ADR-0002), and the full twelve below.
 * Posture and the score trace arrive in later slices.
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
  // Posture (ADR-0004): prefer the reading persisted with the result; derive it
  // from the always-present score trace for legacy sessions that predate it.
  const posture = result.posture ?? readPosture(session.trace);
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));

  // Non-`active` Primaries get arc-aware, non-condemning framing (ADR-0007).
  const framedPrimaries = result.primary
    .map((slug) => ({ tribe: getTribeBySlug(slug), arc: posture[slug]?.arc ?? "unknown" }))
    .filter(
      (p): p is { tribe: NonNullable<ReturnType<typeof getTribeBySlug>>; arc: PostureArc } =>
        !!p.tribe && p.tribe.status !== "active",
    );
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
          <section className="mt-10 flex flex-col gap-5">
            {framedPrimaries.map(({ tribe, arc }) => {
              const reading = arcReading(arc);
              return (
                <div
                  key={tribe.slug}
                  className="rounded-[2px] border-l-2 border-gold/50 bg-faint/[0.04] py-4 pl-5 pr-4"
                >
                  <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
                    {tribe.name} · {statusLabels[tribe.status]}
                    {arcLabel[arc] && ` · ${arcLabel[arc]}`}
                  </div>
                  <p className="mt-2 text-[15px] leading-[1.6] text-muted">
                    {reading && <span>{reading} </span>}
                    {statusNote[tribe.status as Exclude<TribeStatus, "active">]}
                  </p>
                </div>
              );
            })}
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
                const arc = posture[slug]?.arc ?? "unknown";
                const role = isPrimary ? (result.coPrimary ? "Co-Primary" : "Primary") : "Contender";
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
                        {role}
                      </span>
                      {arcLabel[arc] && (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.16em] text-gold/80">
                          · {arcLabel[arc]}
                        </span>
                      )}
                    </Link>
                    <span className="text-[15px] tabular-nums text-muted">
                      {Math.round(pct[slug] ?? 0)}%
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
