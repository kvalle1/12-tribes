import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/interview/session";
import { aggregatePosture, attribution } from "@/lib/interview/scoring";
import { accentHex, tribes } from "@/lib/tribes";
import type { PostureSignal } from "@/lib/interview/types";
import { startInterview } from "../actions";

/**
 * Interim Interview result. Slice #16 wires in real Marker scoring, so this now
 * renders the Strength Profile the Interview actually accumulated — each tribe's
 * normalized share (ADR-0002) and its Posture on the fall→oil arc (ADR-0004) —
 * instead of a placeholder.
 *
 * It is deliberately *interim*: the Primary + dynamic Contenders / Co-Primary
 * framing and the adaptive stop that decides when the Interview is confident are
 * slice #17 (ADR-0006). Reached only once the Session is complete; an in-progress
 * or missing Session routes back to the hub, so a refresh still resolves right.
 */

const POSTURE_LABEL: Record<PostureSignal, string> = {
  "active-shadow": "active shadow",
  aware: "aware of the pull",
  integrated: "integrated",
};

export default async function InterviewResultPage() {
  const session = await currentSession();

  if (!session || session.status !== "complete") {
    redirect("/interview");
  }

  const shares = attribution(session.profile);
  const posture = aggregatePosture(session.traces);

  const ranked = tribes
    .map((tribe) => ({ tribe, share: shares[tribe.slug] ?? 0 }))
    .filter((row) => row.share > 0)
    .sort((a, b) => b.share - a.share);

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
            {ranked.length > 0
              ? `Your Interview leans ${ranked[0].tribe.name}.`
              : "Your Interview is complete."}
          </h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-muted">
            {ranked.length > 0
              ? "This is an early reading of your Strength Profile from your answers. A future slice adds the confident Primary and Contenders."
              : "Your answers didn't surface a clear tribe signal yet — a future slice deepens the questioning."}
          </p>
          <p className="mt-4 text-[14px] text-faint">
            You answered {session.turnCount}{" "}
            {session.turnCount === 1 ? "question" : "questions"}.
          </p>
        </div>

        {ranked.length > 0 && (
          <ul className="mt-8 flex flex-col gap-4">
            {ranked.map(({ tribe, share }) => {
              const accent = accentHex(tribe.color);
              const arc = posture[tribe.slug];
              return (
                <li key={tribe.slug}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[18px]">{tribe.name}</span>
                    <span className="text-[13px] tabular-nums text-muted">
                      {share.toFixed(0)}%
                      {arc ? (
                        <span className="ml-2 text-faint">
                          · {POSTURE_LABEL[arc]}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full rounded-full bg-hair/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(share, 2)}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/*
          A completed Session otherwise dead-ends here: /interview redirects a
          complete Session straight back to this page. This starts a fresh
          Session (overwriting the cookie) so the participant can go again.
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
