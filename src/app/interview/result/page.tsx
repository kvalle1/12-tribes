import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { buildTribeTraces } from "@/lib/interview/score-trace";
import { currentSession } from "@/lib/interview/session";
import type { MarkerType } from "@/lib/interview/types";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { startInterview } from "../actions";

/** Human-readable labels for the Marker field a contribution came from. */
const MARKER_TYPE_LABELS: Record<MarkerType, string> = {
  strength: "Strength",
  oil: "Thrives",
  shadow: "Shadow",
  fallLine: "Fall line",
};

/**
 * Interview result (slice 4, issue #17): the Primary — or honest Co-Primaries
 * when the top tribes never separated (ADR-0006) — plus the dynamic Contender
 * band, each with its display percentage (ADR-0002), and the full twelve below.
 * Each scored tribe carries an expandable score trace (slice 7, issue #21):
 * question shown → Marker signal → delta, built server-side and exposing no raw
 * answer text (issue #10) or scoring internals. Posture arrives in slice 6.
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
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));
  const ranked = Object.entries(pct)
    .map(([slug, value]) => ({ slug, value }))
    .sort((a, b) => b.value - a.value);
  const top = ranked[0]?.value ?? 0;

  // Score trace (issue #21): why each tribe scored as it did, built on the
  // server from the authoritative trace. It cites the question shown and the
  // Marker signal that fired — never the raw answer text (issue #10) or any
  // scoring internals beyond these fields.
  const traceBySlug = new Map(
    buildTribeTraces(session.trace, session.turns).map((t) => [t.tribeSlug, t]),
  );
  const hasTrace = traceBySlug.size > 0;

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
          {hasTrace && (
            <p className="mt-3 text-[13px] leading-[1.6] text-muted">
              Expand a tribe to see the score trace — which question and which
              signal produced each point. Your answers themselves are never
              shown here.
            </p>
          )}
          <ul className="mt-6 flex flex-col gap-3.5">
            {ranked.map((row) => {
              const tribe = getTribeBySlug(row.slug);
              const accent = accentHex(tribe?.color ?? "");
              const width = top > 0 ? (row.value / top) * 100 : 0;
              const trace = traceBySlug.get(row.slug);
              return (
                <li key={row.slug} className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
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
                  </div>

                  {trace && trace.contributions.length > 0 && (
                    <details className="group ml-[124px]">
                      <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink">
                        <span className="group-open:hidden">Why this score ↓</span>
                        <span className="hidden group-open:inline">Hide trace ↑</span>
                      </summary>
                      <ul className="mt-3 flex flex-col gap-2.5 border-l border-hair pl-4">
                        {trace.contributions.map((c, i) => (
                          <li
                            key={`${c.questionNumber}-${i}`}
                            className="flex items-baseline gap-3 text-[13px] leading-[1.5]"
                          >
                            <span className="shrink-0 tabular-nums text-faint">
                              Q{c.questionNumber}
                            </span>
                            <span className="flex-1 text-muted">
                              <span
                                className="mr-2 align-middle text-[10px] uppercase tracking-[0.12em]"
                                style={{ color: accent }}
                              >
                                {MARKER_TYPE_LABELS[c.markerType]}
                              </span>
                              {c.signal}
                            </span>
                            <span className="shrink-0 tabular-nums text-ink">
                              +{c.delta}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
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
