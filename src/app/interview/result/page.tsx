import Link from "next/link";
import { redirect } from "next/navigation";
import { stubResult } from "@/lib/interview/flow";
import { getMarkerById } from "@/lib/interview/markers";
import { normalizeProfile } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result — slice 3 (#16). This is an early, single-question read: the
 * Strength Profile below is scored from the participant's answer against the
 * Marker Catalog, and the score trace shows *why* (ADR-0003). Naming a Primary +
 * Contenders and the multi-Turn loop arrive in later slices.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const result = stubResult({
    status: session.status,
    turns: session.turns,
    profile: session.profile,
    posture: session.posture,
    trace: session.trace,
  });

  const normalized = normalizeProfile(session.profile);
  const ranked = Object.entries(normalized)
    .map(([slug, pct]) => ({ tribe: getTribeBySlug(slug), slug, pct }))
    .filter((row) => row.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  const maxPct = ranked.length > 0 ? ranked[0].pct : 0;

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
            {result.headline}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            {result.note}
          </p>
        </div>

        {ranked.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Strength Profile
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {ranked.map(({ tribe, slug, pct }) => {
                const accent = accentHex(tribe?.color ?? "");
                return (
                  <li key={slug} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between text-[14px]">
                      <span className="font-serif">
                        {tribe?.name ?? slug}
                        {tribe ? (
                          <span className="ml-2 text-[12px] text-faint">
                            {tribe.callSign}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-muted">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="h-[6px] w-full overflow-hidden rounded-full bg-hair">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${maxPct > 0 ? (pct / maxPct) * 100 : 0}%`,
                          backgroundColor: accent,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p className="mt-12 text-[14px] text-faint">
            Your answer didn&rsquo;t land firmly on any tribe&rsquo;s Markers yet
            — later slices ask more to build a fuller picture.
          </p>
        )}

        {session.trace.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Why — score trace
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {session.trace.map((entry, i) => {
                const marker = getMarkerById(entry.markerId);
                const tribe = getTribeBySlug(entry.tribeSlug);
                return (
                  <li
                    key={`${entry.markerId}-${i}`}
                    className="rounded-[2px] border border-hair bg-white px-4 py-3 text-[13px] leading-[1.5]"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-medium">
                        {tribe?.name ?? entry.tribeSlug}
                      </span>
                      <span className="tabular-nums text-faint">
                        +{entry.delta} · {entry.type}
                      </span>
                    </div>
                    <p className="mt-1 text-muted">
                      {marker?.signal ?? entry.markerId}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page, so the start screen is
          unreachable. This starts a fresh Session (overwriting the cookie) so
          the participant can go again.
        */}
        <form action={startInterview} className="mt-12">
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
