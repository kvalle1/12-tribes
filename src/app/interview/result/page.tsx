import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/interview/session";
import { tribes } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result page. Renders the computed result persisted on completion:
 * the headline Primary tribe and the normalized Strength Profile across all 12
 * tribes (ADR-0002). The dynamic Contender set, Posture, and the score-trace
 * view arrive in later slices.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete" || !session.result) {
    redirect("/interview");
  }

  const { primarySlug, normalized } = session.result;
  const bySlug = new Map(tribes.map((t) => [t.slug, t]));
  const primary = bySlug.get(primarySlug);

  // Rank all 12 tribes by normalized share, highest first.
  const ranked = tribes
    .map((t) => ({ tribe: t, score: normalized[t.slug] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // No cited Markers means every tribe is tied at zero — naming a "Primary" off
  // that tie would be misleading, so report it honestly as inconclusive. (Far
  // less likely once the multi-Turn loop lands in slice #17.)
  const hasSignal = ranked.some(({ score }) => score > 0);

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
          {hasSignal && primary ? (
            <>
              <h1 className="mt-3 font-serif text-[40px] font-semibold leading-[1.05]">
                {primary.name}
              </h1>
              <p className="mt-1 text-[15px] uppercase tracking-[0.14em] text-gold">
                {primary.callSign}
              </p>
              <p className="mt-4 text-[16px] leading-[1.6] text-muted">
                {primary.essence}
              </p>
              <p className="mt-6 font-hebrew text-[28px] leading-none text-ink">
                {primary.hebrew}
              </p>
              <Link
                href={`/tribes/${primary.slug}`}
                className="mt-6 inline-block text-[13px] uppercase tracking-[0.12em] text-ink underline underline-offset-4 transition-colors hover:text-gold"
              >
                Read the full {primary.name} profile →
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
                The signal wasn&rsquo;t clear yet.
              </h1>
              <p className="mt-4 text-[16px] leading-[1.6] text-muted">
                That answer didn&rsquo;t surface enough to name a tribe. Try the
                interview again with a fuller, more personal response.
              </p>
            </>
          )}
        </div>

        {hasSignal && (
          <section className="mt-12">
            <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
              How every tribe scored
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {ranked.map(({ tribe, score }) => (
                <li key={tribe.slug} className="flex items-center gap-3">
                  <span className="w-[110px] shrink-0 text-[14px] text-ink">
                    {tribe.name}
                  </span>
                  <span className="h-[8px] flex-1 rounded-[2px] bg-hair/60">
                    <span
                      className="block h-full rounded-[2px] bg-gold"
                      style={{ width: `${score}%` }}
                    />
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                    {score}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-[14px] text-faint">
          You answered {session.turnCount}{" "}
          {session.turnCount === 1 ? "question" : "questions"}.
        </p>

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page. This starts a fresh
          Session (overwriting the cookie) so the participant can go again.
        */}
        <form action={startInterview} className="mt-8">
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
