import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { POSTURE_LABELS, statusFraming } from "@/lib/interview/posture";
import { accumulatePosture } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { TribePosture } from "@/lib/interview/types";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result (slice 4, issue #17): the Primary — or honest Co-Primaries
 * when the top tribes never separated (ADR-0006) — plus the dynamic Contender
 * band, each with its display percentage (ADR-0002) and Posture on the tribe's
 * fall→oil arc (ADR-0004, slice 6), and the full twelve below. A disqualified
 * or warning-tribe Primary gets non-condemning, arc-aware framing (ADR-0007).
 * The score trace arrives in a later slice.
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
    : summarize(session.profile, session.trace);
  // Results completed before slice 6 carry no Posture; replay it from the trace.
  const posture = result.posture ?? accumulatePosture(session.trace, Object.keys(session.profile));
  const pct = result.percentages;
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
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
                  <li key={slug} className="border-b border-hair pb-3">
                    <div className="flex items-baseline justify-between gap-4">
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
                    </div>
                    {posture[slug] && (
                      <PostureArc posture={posture[slug]} accent={accentHex(tribe?.color ?? "")} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {result.primary.map((slug) => {
          const tribe = getTribeBySlug(slug);
          const framing = tribe && statusFraming(tribe, posture[slug]?.reading ?? "unread");
          if (!tribe || !framing) return null;
          return (
            <section
              key={slug}
              className="mt-12 rounded-[2px] border border-hair bg-white/40 p-8"
            >
              <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
                {tribe.name} · {framing.label}
              </p>
              <p className="mt-4 text-[16px] leading-[1.6] text-ink/90">{framing.status}</p>
              <p className="mt-3 text-[16px] leading-[1.6] text-muted">{framing.arc}</p>
              {framing.exemplar && (
                <p className="mt-4 border-l-2 border-gold/50 pl-4 text-[14px] italic leading-[1.6] text-muted">
                  {framing.exemplar.description}
                </p>
              )}
            </section>
          );
        })}

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

/**
 * A tribe's Posture as a small fall→oil track (ADR-0004): shadow on the left,
 * oil on the right, with a marker at the participant's arc position. An unread
 * Posture shows the label alone, since there is no position to mark.
 */
function PostureArc({ posture, accent }: { posture: TribePosture; accent: string }) {
  const position = posture.arc === null ? null : ((posture.arc + 1) / 2) * 100;
  return (
    <div className="mt-2.5 flex items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-faint">
      <span className="shrink-0">Shadow</span>
      <span className="relative h-[4px] flex-1 rounded-full bg-hair/60">
        {position !== null && (
          <span
            className="absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${position}%`, backgroundColor: accent }}
          />
        )}
      </span>
      <span className="shrink-0">Oil</span>
      <span className="w-[96px] shrink-0 text-right normal-case tracking-normal text-muted">
        {POSTURE_LABELS[posture.reading]}
      </span>
    </div>
  );
}
