import Link from "next/link";
import { redirect } from "next/navigation";
import { tribes, accentHex } from "@/lib/tribes";
import { deriveResult } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import { startInterview } from "../actions";

/**
 * Interview result page. As of the real-scoring slice (#16) this renders the
 * derived Strength Profile — the ranked, display-normalized per-tribe scores
 * (ADR-0002) — computed from the Session's persisted `profile`. The result is
 * recomputed from the profile so the view can never drift from the stored
 * scores. Posture, Contenders/Co-Primaries, and the full score-trace view are
 * later slices (#17/#20/#21); here we surface the ranked bars and a compact
 * per-answer Marker trace.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const result = session.result ?? deriveResult(session.profile);
  const primary = result.primarySlug
    ? tribes.find((t) => t.slug === result.primarySlug)
    : undefined;
  const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));
  const maxPercent = Math.max(...result.shares.map((s) => s.percent), 1);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          Interview complete
        </div>

        {primary ? (
          <div
            className="mt-3 rounded-[2px] border p-8"
            style={{
              borderColor: `${accentHex(primary.color)}66`,
              backgroundColor: `${accentHex(primary.color)}0d`,
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              Your leading tribe
            </div>
            <h1 className="mt-2 font-serif text-[38px] font-semibold leading-[1.05]">
              {primary.name}
            </h1>
            <p className="mt-2 text-[16px] text-muted">
              {primary.hebrew} · {primary.essence}
            </p>
            <Link
              href={`/tribes/${primary.slug}`}
              className="mt-5 inline-block text-[13px] uppercase tracking-[0.12em] text-ink underline underline-offset-4 hover:text-black"
            >
              Read the full profile →
            </Link>
          </div>
        ) : (
          <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
            Your interview is complete.
          </h1>
        )}

        {/* Ranked, display-normalized Strength Profile (all 12 tribes). */}
        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
            How every tribe scored
          </h2>
          <ul className="mt-5 flex flex-col gap-3">
            {result.shares.map((share) => {
              const tribe = tribeBySlug.get(share.slug);
              const hex = tribe ? accentHex(tribe.color) : "#8a7a5c";
              return (
                <li key={share.slug} className="flex items-center gap-4">
                  <span className="w-[120px] shrink-0 text-[14px]">
                    {share.name}
                  </span>
                  <span className="relative h-[10px] flex-1 rounded-full bg-hair/40">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${(share.percent / maxPercent) * 100}%`,
                        backgroundColor: hex,
                      }}
                    />
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                    {share.percent.toFixed(0)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Compact score trace: which answers cited which Markers (ADR-0003). */}
        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Why you scored this way
          </h2>
          <div className="mt-5 flex flex-col gap-6">
            {session.turns.map((turn, i) => (
              <div key={i}>
                <p className="font-serif text-[16px] leading-[1.4]">
                  {turn.question}
                </p>
                {turn.deltas.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
                    {turn.deltas.map((d, j) => {
                      const tribe = tribeBySlug.get(d.tribeSlug);
                      return (
                        <li key={j}>
                          {tribe?.name ?? d.tribeSlug} · {d.type} ·{" "}
                          <span className="text-faint">{d.markerId}</span> (+
                          {d.contribution.toFixed(2)})
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-faint">
                    No markers evidenced by this answer.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

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
