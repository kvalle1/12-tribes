import Link from "next/link";
import { redirect } from "next/navigation";
import { summarize } from "@/lib/interview/confidence";
import { accumulatePosture } from "@/lib/interview/scoring";
import { currentSession } from "@/lib/interview/session";
import type { PostureReading, PostureSignal } from "@/lib/interview/types";
import { accentHex, getTribeBySlug, statusLabels, type Tribe } from "@/lib/tribes";
import { startInterview } from "../actions";

/**
 * The fall→oil arc, low to high (ADR-0004). Posture names where on it the
 * participant's answers place them for a given tribe; `neutral` reads as the
 * arc not yet resolved rather than a midpoint.
 */
const POSTURE_STOPS: readonly { key: PostureSignal; label: string }[] = [
  { key: "active-shadow", label: "Active shadow" },
  { key: "neutral", label: "Emerging" },
  { key: "integrated", label: "Integrated" },
];

function postureLabel(arc: PostureSignal): string {
  return POSTURE_STOPS.find((s) => s.key === arc)?.label ?? "Emerging";
}

/**
 * Non-condemning, arc-aware framing for a disqualified- or warning-status
 * Primary (ADR-0007). A tribe's cautionary status is never a verdict on the
 * participant; the reading bends with their Posture — the integrated end is the
 * redemption reading, the active-shadow end a caution to heed, neutral still
 * open. Returns null for an active tribe, which needs no framing.
 */
function arcFraming(tribe: Tribe, arc: PostureSignal): { title: string; body: string } | null {
  if (tribe.status === "active") return null;

  const base =
    tribe.status === "warning"
      ? `${tribe.name} is a warning tribe — its pattern is a caution to move through, never a sentence passed on you.`
      : `${tribe.name} carries a disqualification arc in Scripture: a severe warning, not a permanent rejection. Restoration is part of the story.`;

  const arcLine =
    arc === "integrated"
      ? "Your answers place you toward its redeemed, integrated end — the same wiring surrendered to its oil. Read this as the redemption end of the arc."
      : arc === "active-shadow"
        ? "Your answers lean toward its active-shadow pattern. Take it as a caution to heed, not a verdict — the arc bends back toward its oil when the gift is surrendered."
        : "Where you sit on the arc is still emerging. Nothing here is fixed — its redemptive end is open to you.";

  return { title: statusLabels[tribe.status], body: `${base} ${arcLine}` };
}

/** A compact three-stop meter marking where on the fall→oil arc a tribe reads. */
function PostureArc({
  reading,
  accent,
}: {
  reading: PostureReading | undefined;
  accent: string;
}) {
  const arc = reading?.arc ?? "neutral";
  return (
    <div
      className="mt-2 flex items-center gap-2"
      role="img"
      aria-label={`Posture: ${postureLabel(arc)}`}
    >
      <span className="flex gap-1" aria-hidden>
        {POSTURE_STOPS.map((stop) => (
          <span
            key={stop.key}
            className="h-[6px] w-[22px] rounded-full bg-hair"
            style={stop.key === arc ? { backgroundColor: accent } : undefined}
          />
        ))}
      </span>
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
        {postureLabel(arc)}
      </span>
    </div>
  );
}

/**
 * Interview result (slice 4, issue #17): the Primary — or honest Co-Primaries
 * when the top tribes never separated (ADR-0006) — plus the dynamic Contender
 * band, each with its display percentage (ADR-0002), and the full twelve below.
 *
 * Slice 6 (issue #20) adds the Posture axis: each Primary/Contender shows where
 * on that tribe's fall→oil arc the answers place the participant (ADR-0004), and
 * a disqualified- or warning-status Primary is framed with non-condemning,
 * arc-aware copy (ADR-0007). Posture is derived from the persisted score trace.
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
  const postures = accumulatePosture(session.trace);
  const primaryNames = result.primary.map((slug) => getTribeBySlug(slug)?.name ?? slug);
  const otherContenders = result.contenders.filter((slug) => !result.primary.includes(slug));
  // Non-condemning framing for any Primary whose tribe carries a cautionary
  // status (ADR-0007), read against that tribe's Posture.
  const primaryFramings = result.primary.flatMap((slug) => {
    const tribe = getTribeBySlug(slug);
    if (!tribe) return [];
    const framing = arcFraming(tribe, postures[slug]?.arc ?? "neutral");
    return framing ? [{ slug, tribe, framing }] : [];
  });
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

        {primaryFramings.map(({ slug, tribe, framing }) => (
          <aside
            key={slug}
            className="mt-6 rounded-[2px] border border-hair bg-bone px-6 py-5"
          >
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
              {tribe.name} · {framing.title}
            </div>
            <p className="mt-2 text-[14px] leading-[1.6] text-muted">{framing.body}</p>
          </aside>
        ))}

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
                    className="flex items-start justify-between gap-4 border-b border-hair pb-3"
                  >
                    <div>
                      <Link
                        href={`/tribes/${slug}`}
                        className="font-serif text-[22px] transition-colors hover:text-gold"
                      >
                        {tribe?.name ?? slug}
                        <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-faint">
                          {isPrimary ? (result.coPrimary ? "Co-Primary" : "Primary") : "Contender"}
                        </span>
                      </Link>
                      <PostureArc reading={postures[slug]} accent={accentHex(tribe?.color ?? "")} />
                    </div>
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
