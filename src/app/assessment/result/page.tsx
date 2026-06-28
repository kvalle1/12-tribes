import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { deriveResult, score, type TribeScore } from "@/lib/assessment/score";
import { getTribeBySlug } from "@/lib/tribes";
import { accentHex } from "@/lib/accent";

/**
 * The Subject's result. The saved words are scored on demand by the pure
 * scoring core, so this page renders identically whether reached right after
 * submitting or when revisiting the saved current result.
 *
 * This slice (#5) shows the headline only — Primary (and Secondary when one
 * qualifies) with call sign, essence, and Hebrew. The 12-tribe ranking bars,
 * the selected words, and the profile links are the next slice (#6).
 */
export default async function AssessmentResultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/assessment/result")}`);
  }

  const row = await getCurrentResult(session.user.id);
  if (!row) {
    // No saved result yet — start the assessment.
    redirect("/assessment");
  }

  const { primary, secondary } = deriveResult(score(row.words));

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[96px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <div className="mt-10 text-[11px] uppercase tracking-[0.18em] text-faint">
          Your tribe
        </div>

        <TribeHeadline tribeScore={primary} role="Primary" emphasis />
        {secondary ? (
          <TribeHeadline tribeScore={secondary} role="Secondary" />
        ) : null}

        <div className="mt-12 flex flex-wrap gap-[22px]">
          <Link
            href="/assessment"
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Retake the assessment
          </Link>
        </div>
      </div>
    </main>
  );
}

/**
 * A headline card for one tribe in the result. The Primary is rendered with
 * emphasis; an optional Secondary is rendered smaller below it.
 */
function TribeHeadline({
  tribeScore,
  role,
  emphasis = false,
}: {
  tribeScore: TribeScore;
  role: "Primary" | "Secondary";
  emphasis?: boolean;
}) {
  const tribe = getTribeBySlug(tribeScore.slug);
  if (!tribe) return null;

  const accent = accentHex(tribe.color);

  return (
    <section
      className={
        emphasis
          ? "mt-6 rounded-[2px] border border-hair bg-white p-8"
          : "mt-5 rounded-[2px] border border-hair bg-white/60 p-6"
      }
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">
        {role}
      </div>
      <div className="mt-2 flex items-end justify-between gap-4">
        <div>
          <h2
            className={
              emphasis
                ? "font-serif text-[52px] font-semibold leading-none"
                : "font-serif text-[34px] font-semibold leading-none"
            }
            style={{ color: accent }}
          >
            {tribe.name}
          </h2>
          <div
            className={
              emphasis
                ? "mt-2 font-serif text-[20px] italic text-muted"
                : "mt-1.5 font-serif text-[17px] italic text-muted"
            }
          >
            {tribe.callSign}
          </div>
        </div>
        <div
          className={
            emphasis
              ? "font-hebrew text-[44px] font-medium leading-none"
              : "font-hebrew text-[32px] font-medium leading-none"
          }
          style={{ color: accent }}
        >
          {tribe.hebrew}
        </div>
      </div>
      <div className="mt-4 text-[11px] uppercase tracking-[0.13em] text-faint">
        {tribe.essence}
      </div>
    </section>
  );
}
