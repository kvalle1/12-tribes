import { getTribeBySlug, type Tribe } from "@/lib/tribes";

/**
 * Pure view-model for the account page: given what we know about a Participant
 * (their saved Self Assessment, how many Observers have responded, and their
 * Interview Session), decide what each instrument card should show and what the
 * single best "next step" is. No DB, no scoring, no React — client-safe and unit
 * tested; the page just renders it.
 */

/** Observers needed before the 360 comparison can be shown (matches result page copy). */
export const OBSERVERS_NEEDED = 3;

export interface AccountOverviewInput {
  name?: string | null;
  email?: string | null;
  assessment: {
    primarySlug: string;
    secondarySlug?: string | null;
    updatedAt: Date;
  } | null;
  observerCount: number;
  interview: { status: "in_progress" | "complete"; turnCount: number } | null;
}

export interface NextStep {
  href: string;
  label: string;
}

export type ObserverProgress =
  | { status: "locked"; count: 0; needed: number; remaining: number }
  | {
      status: "collecting" | "ready";
      count: number;
      needed: number;
      remaining: number;
    };

export type InterviewProgress =
  | { status: "not-started"; turnCount: 0 }
  | { status: "in-progress" | "complete"; turnCount: number };

export interface AccountOverview {
  displayName: string;
  nextStep: NextStep;
  strengthTribes: Tribe[];
  self: { status: "not-started" | "complete" };
  observers: ObserverProgress;
  interview: InterviewProgress;
  /** Instruments finished, out of three (Self, 360, Interview). */
  completedCount: number;
}

export function buildAccountOverview(input: AccountOverviewInput): AccountOverview {
  const { assessment } = input;
  const strengthTribes = assessment
    ? [assessment.primarySlug, assessment.secondarySlug]
        .map((slug) => (slug ? getTribeBySlug(slug) : undefined))
        .filter((t): t is Tribe => Boolean(t))
    : [];

  const observers = observerProgress(Boolean(assessment), input.observerCount);
  const interview: InterviewProgress = !input.interview
    ? { status: "not-started", turnCount: 0 }
    : {
        status: input.interview.status === "complete" ? "complete" : "in-progress",
        turnCount: input.interview.turnCount,
      };

  return {
    displayName: greetingName(input.name, input.email),
    self: { status: assessment ? "complete" : "not-started" },
    observers,
    interview,
    strengthTribes,
    completedCount: [
      Boolean(assessment),
      observers.status === "ready",
      interview.status === "complete",
    ].filter(Boolean).length,
    nextStep: pickNextStep(Boolean(assessment), observers, interview, strengthTribes),
  };
}

function observerProgress(hasAssessment: boolean, count: number): ObserverProgress {
  if (!hasAssessment) {
    return { status: "locked", count: 0, needed: OBSERVERS_NEEDED, remaining: OBSERVERS_NEEDED };
  }
  const remaining = Math.max(OBSERVERS_NEEDED - count, 0);
  return {
    status: remaining === 0 ? "ready" : "collecting",
    count,
    needed: OBSERVERS_NEEDED,
    remaining,
  };
}

/** One clear nudge: self → observers → interview → dive into your strengths. */
function pickNextStep(
  hasAssessment: boolean,
  observers: ObserverProgress,
  interview: InterviewProgress,
  strengthTribes: Tribe[],
): NextStep {
  if (!hasAssessment) {
    return { href: "/assessment", label: "Take the Self Assessment" };
  }
  if (observers.status !== "ready") {
    return { href: "/assessment/result#share", label: "Invite people to describe you" };
  }
  if (interview.status === "in-progress") {
    return { href: "/interview", label: "Continue your Interview" };
  }
  if (interview.status === "not-started") {
    return { href: "/interview", label: "Start the Interview" };
  }
  return {
    href: strengthTribes[0] ? `/tribes/${strengthTribes[0].slug}` : "/",
    label: "Go deeper into your strengths",
  };
}

/** Name → email local part → "friend". Magic-link sign-in means `name` is often null. */
function greetingName(name?: string | null, email?: string | null): string {
  return name?.trim() || email?.split("@")[0]?.trim() || "friend";
}
