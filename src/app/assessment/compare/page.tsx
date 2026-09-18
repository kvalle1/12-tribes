import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponseWords } from "@/lib/observer/repository";
import { score } from "@/lib/assessment/score";
import {
  MIN_OBSERVERS,
  aggregateObservers,
  isComparisonUnlocked,
} from "@/lib/observer/aggregate";
import { accentHex, getTribeBySlug } from "@/lib/tribes";
import {
  ObserverComparisonReport,
  type ComparisonTribe,
} from "@/components/observer-comparison";

/**
 * The 360 comparison report (issue #9, ADR-0003): the Subject's own profile
 * alongside the equal-weight aggregated "others" profile, with an anonymous
 * per-observer drill-down.
 *
 * Login-gated — an unauthenticated visitor routes through sign-in, and a
 * signed-in user with no saved result is sent to take the assessment first
 * (there is nothing to compare against without their own profile). The report
 * stays **locked until at least three observers respond** (ADR-0003): fewer
 * makes the average thin and, with per-observer drill-down, would not protect
 * individual anonymity. Aggregation runs server-side via the pure, unit-tested
 * `aggregateObservers`; only numeric per-tribe scores reach the client.
 */
export default async function ComparisonPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=${encodeURIComponent("/assessment/compare")}`,
    );
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) redirect("/assessment");

  const responses = await getObserverResponseWords(session.user.id);
  const { observerCount, average, perObserver } = aggregateObservers(responses);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/assessment/result"
          className="mb-10 inline-block text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Your result
        </Link>

        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          Your 360 read
        </p>
        <h1 className="mt-2 font-serif text-[clamp(34px,6vw,52px)] font-semibold leading-[1.05]">
          How others see you
        </h1>

        {isComparisonUnlocked(observerCount) ? (
          <>
            <p className="mt-4 max-w-[540px] text-[15px] text-muted">
              Your own reading sits beside the equal-weight average of{" "}
              {observerCount} anonymous {observerCount === 1 ? "observer" : "observers"}
              . Each observer counts the same, however many words they picked —
              the gap between the two reads is where growth tends to live.
            </p>
            <div className="mt-12">
              <ObserverComparisonReport
                tribes={buildComparisonTribes(row.words, average)}
                perObserver={perObserver.map((obs, i) => ({
                  label: `Observer ${i + 1}`,
                  scores: obs.map((s) => ({ slug: s.slug, score: s.score })),
                }))}
              />
            </div>
          </>
        ) : (
          <LockedState observerCount={observerCount} />
        )}
      </div>
    </main>
  );
}

/**
 * Merge the Subject's own normalized scores with the aggregated "others" scores
 * into the per-tribe view model, resolving each tribe's accent hex server-side.
 * Canonical (tribe `number`) order is preserved; the client view re-ranks.
 */
function buildComparisonTribes(
  selfWords: string[],
  others: { slug: string; name: string; score: number }[],
): ComparisonTribe[] {
  const selfBySlug = new Map(score(selfWords).map((s) => [s.slug, s.score]));
  return others.map((o) => ({
    slug: o.slug,
    name: o.name,
    accent: accentHex(getTribeBySlug(o.slug)?.color ?? ""),
    self: selfBySlug.get(o.slug) ?? 0,
    others: o.score,
  }));
}

function LockedState({ observerCount }: { observerCount: number }) {
  const remaining = MIN_OBSERVERS - observerCount;
  return (
    <div className="mt-8 rounded-[2px] border border-hair bg-white/60 p-8">
      <p className="text-[12px] uppercase tracking-[0.16em] text-faint">
        Locked · {observerCount} of {MIN_OBSERVERS} responses
      </p>
      <p className="mt-4 text-[17px] leading-relaxed text-ink">
        {observerCount === 0
          ? "No one has described you yet."
          : `${observerCount} ${observerCount === 1 ? "person has" : "people have"} responded so far.`}{" "}
        Your comparison unlocks once{" "}
        <span className="text-gold">{MIN_OBSERVERS} observers</span> have
        weighed in — enough for the average to mean something, and to keep each
        response anonymous.
      </p>
      <p className="mt-3 text-[15px] text-muted">
        {remaining === 1
          ? "Just one more response to go."
          : `${remaining} more responses to go.`}
      </p>
      <Link
        href="/assessment/result"
        className="mt-6 inline-block rounded-[2px] bg-ink px-[26px] py-[12px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
      >
        Invite more observers
      </Link>
    </div>
  );
}
