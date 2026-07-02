import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/interview/session";
import { rankedProfile } from "@/lib/interview/scoring";
import { accentHex, tribes } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * Interview result — the real Strength Profile (slice #16).
 *
 * The scored answer's cited Marker deltas have been folded into the Session's
 * `profile`; here we rank all 12 tribes and show each as a proportional bar
 * (ADR-0002). The full multi-Turn interview, Posture, and the inspectable score
 * trace arrive in later slices (#17, #20, #21) — this view already renders the
 * genuine, computed profile rather than a placeholder.
 *
 * Reached only once the Session is complete — an in-progress or missing Session
 * routes back to the hub, so a refresh here still resolves to the right place.
 */
export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const ranked = rankedProfile(session.profile);
  const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));
  const scored = ranked.some((tribe) => tribe.score > 0);
  const top = ranked[0];

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[620px] px-8 py-[120px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.16em] text-faint">
          Interview complete
        </div>
        <h1 className="mt-3 font-serif text-[34px] font-semibold leading-[1.1]">
          {scored ? (
            <>
              Your strongest signal is{" "}
              <span style={{ color: accentHex(colorBySlug.get(top.slug) ?? "") }}>
                {top.name}
              </span>
              .
            </>
          ) : (
            <>Your interview is complete.</>
          )}
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-muted">
          {scored
            ? "Here is how each of the twelve tribes scored from what you shared. This reads a single answer — a fuller, multi-question interview arrives in a later slice."
            : "Your answer didn't surface a clear signal yet. A fuller interview with more questions arrives in a later slice."}
        </p>

        <ol className="mt-10 flex flex-col gap-3">
          {ranked.map((tribe) => (
            <li key={tribe.slug} className="flex items-center gap-4">
              <span className="w-[92px] shrink-0 text-[14px] text-ink">{tribe.name}</span>
              <span className="relative h-[10px] flex-1 overflow-hidden rounded-full bg-hair">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${tribe.percent}%`,
                    backgroundColor: accentHex(colorBySlug.get(tribe.slug) ?? ""),
                  }}
                />
              </span>
              <span className="w-[44px] shrink-0 text-right text-[13px] tabular-nums text-muted">
                {Math.round(tribe.percent)}%
              </span>
            </li>
          ))}
        </ol>

        {scored && top.slug ? (
          <Link
            href={`/tribes/${top.slug}`}
            className="mt-8 inline-block text-[13px] uppercase tracking-[0.14em] text-gold transition-colors hover:text-ink"
          >
            Read the {top.name} profile →
          </Link>
        ) : null}

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page. This starts a fresh Session
          (overwriting the cookie) so the participant can go again.
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
