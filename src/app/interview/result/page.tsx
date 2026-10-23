import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/interview/session";
import { normalize } from "@/lib/interview/scoring";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result for slice 3 (issue #16): the real Strength Profile the agent
 * scored from the participant's answers, normalized to display percentages
 * (ADR-0002). The Primary + dynamic Contender framing, Posture, and the score
 * trace arrive in later slices; here the twelve normalized shares make the real
 * scoring visible end-to-end.
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

  const pct = normalize(session.profile);
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
            Your strength profile
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            Scored from your {session.turnCount}{" "}
            {session.turnCount === 1 ? "answer" : "answers"} against the Marker
            Catalog. Each share reflects how strongly your words resonated with a
            tribe&rsquo;s signals — the full reading (a primary with its
            contenders) comes as the Interview grows.
          </p>
        </div>

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
