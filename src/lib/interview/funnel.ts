import { rank, summarize } from "./confidence";
import type {
  Dilemma,
  FunnelPhase,
  PendingTurn,
  ScoreTraceEntry,
  StrengthProfile,
} from "./types";

/**
 * The Funnel planner (ADR-0005) — pure question-selection logic that decides,
 * each Turn, what the participant is asked next. It is deliberately separate
 * from the Confidence / Stop evaluator (`confidence.ts`): that module decides
 * *whether* to keep going, this one decides *what to ask* when we do.
 *
 * Two phases, broad→specific:
 *
 *  - **Calibration** — a short, fixed opening of broad "feeler" questions that
 *    touch every tribe's territory at low resolution. This is an anti-anchoring
 *    floor, not mere structure: it gives all 12 tribes a fair look before the
 *    agent commits attention, so the first answer can't railroad the result.
 *    The model's proposed question is ignored here — the opening is fixed.
 *
 *  - **Discrimination** — information-gain questioning that targets whatever best
 *    separates the live **Contenders**. The planner exposes the Contender set and
 *    the leader/dark-horse targets (`contenderTargets`) so the agent is steered to
 *    *demote the leader* or promote a dark horse rather than confirm the current
 *    #1 (ADR-0005). When two Contenders are stuck in a persistent tie, the planner
 *    deploys a **Dilemma** (ADR-0008) instead of another free-text question.
 *
 * Pure and client-safe in spirit (no catalog, no secrets, no I/O); it reads only
 * the running profile and score trace. The authored Calibration questions and
 * Dilemma bank are participant-facing content, so they live here with the logic.
 */

/**
 * The fixed Calibration opening. Broad, neutral "feeler" questions that each
 * touch several tribes' territory at once, asked in this order before any
 * narrowing. The first is the Interview's opener.
 */
export const CALIBRATION_QUESTIONS: readonly string[] = [
  "To begin, tell me about a recent time you felt most like yourself. What were you doing, and what made it feel right?",
  "When something matters to you and it's going wrong, what do you find yourself doing about it?",
  "Think about the people around you. What do they most often come to you for — and what do you wish they'd come to you for instead?",
  "Tell me about a time things got hard. What kept you going, and what did you lean on?",
];

/** The Interview's opening question (the first Calibration question). */
export const OPENING_QUESTION = CALIBRATION_QUESTIONS[0];

/**
 * How many opening Turns are Calibration before the Funnel switches to
 * Discrimination. Kept below the Stop Condition's floor (`MIN_TURNS`) so
 * Calibration always completes before any result can be reported.
 */
export const CALIBRATION_TURNS = CALIBRATION_QUESTIONS.length;

/**
 * Neutral authored questions used in Discrimination only when the agent fails to
 * propose one, so a missing model proposal never stalls the loop. Cycled by Turn.
 */
export const DISCRIMINATION_FALLBACKS: readonly string[] = [
  "Think of a time you were under real pressure. What did you do, and why that?",
  "Tell me about something that frustrates you more than it seems to frustrate others.",
  "Describe a decision you're proud of. What made it the right call for you?",
  "When a group you're part of is stuck, what role do you usually end up playing?",
  "What's something you've had to grow out of, and what did that look like?",
];

/** A tribe scoring at least this fraction of the leader is treated as tied with it. */
export const DILEMMA_TIE_BAND = 0.9;

/** A tie must hold across this many recent Turns to count as stubborn. */
export const DILEMMA_STUBBORN_TURNS = 3;

/** Which Funnel phase the Turn at this 0-based index belongs to. */
export function phaseFor(turnsCompleted: number): FunnelPhase {
  return turnsCompleted < CALIBRATION_TURNS ? "calibration" : "discrimination";
}

export interface ContenderTargets {
  /** The live Contender set, strongest first (Primary plus tribes within its band). */
  contenders: string[];
  /** The current leader — the tribe Discrimination should try to demote, not confirm. */
  leader: string | null;
  /** The strongest non-leader Contender — the dark horse to try to promote. */
  darkHorse: string | null;
}

/**
 * The leader to demote and the dark horse to promote, derived from the live
 * Contender band (ADR-0005). Discrimination targets *separating* this set, biased
 * against confirming the leader; this is the data the agent's steering consumes.
 */
export function contenderTargets(profile: StrengthProfile): ContenderTargets {
  const { contenders } = summarize(profile);
  const leader = contenders[0] ?? null;
  const darkHorse = contenders.find((slug) => slug !== leader) ?? null;
  return { contenders, leader, darkHorse };
}

/** A sorted pair key so a tie between the same two tribes compares equal either way. */
function pairKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function samePair(a: readonly [string, string], b: readonly [string, string]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * The tied top-two pair after each cumulative Turn, replayed from the trace — or
 * `null` for a Turn whose top two were *not* tied. A pair is "tied" when the
 * runner scores at least `DILEMMA_TIE_BAND` of the leader. This needs no extra
 * persisted state: the trace already records every delta per Turn.
 */
function tiedPairHistory(
  trace: readonly ScoreTraceEntry[],
  turnCount: number,
): ([string, string] | null)[] {
  const running: StrengthProfile = {};
  const history: ([string, string] | null)[] = [];
  for (let turn = 0; turn < turnCount; turn++) {
    for (const entry of trace) {
      if (entry.turnIndex === turn) {
        running[entry.tribeSlug] = (running[entry.tribeSlug] ?? 0) + entry.delta;
      }
    }
    const ranked = rank(running);
    const [leader, runner] = ranked;
    if (leader && runner && leader.score > 0 && runner.score / leader.score >= DILEMMA_TIE_BAND) {
      history.push(pairKey(leader.slug, runner.slug));
    } else {
      history.push(null);
    }
  }
  return history;
}

/**
 * The tied Contender pair that has been stuck in a tie across the last
 * `DILEMMA_STUBBORN_TURNS` Turns, or `null` when there is no such stubborn tie.
 * Only fires in Discrimination (a Dilemma is never a Calibration opening), and
 * only when the *same* two tribes have been tied, not merely the same pair on
 * top: a one-Turn-old tie is not stubborn (ADR-0008 — the targeted exception, not
 * the default).
 */
export function stubbornTie(
  profile: StrengthProfile,
  trace: readonly ScoreTraceEntry[],
  turnsCompleted: number,
): [string, string] | null {
  if (phaseFor(turnsCompleted) !== "discrimination") return null;
  if (turnsCompleted < DILEMMA_STUBBORN_TURNS) return null;

  // The current profile is authoritative for "tied now" and names the pair.
  const [leader, runner] = rank(profile);
  if (!leader || !runner || leader.score <= 0) return null;
  if (runner.score / leader.score < DILEMMA_TIE_BAND) return null;
  const current = pairKey(leader.slug, runner.slug);

  // The tie must also have held across the last few Turns, not just this one.
  const recent = tiedPairHistory(trace, turnsCompleted).slice(-DILEMMA_STUBBORN_TURNS);
  if (recent.length < DILEMMA_STUBBORN_TURNS) return null;
  return recent.every((pair) => pair !== null && samePair(pair, current)) ? current : null;
}

/**
 * A small bank of tribe-pair Dilemmas (ADR-0008), keyed by the sorted tribe pair.
 * Each poses two concrete, **tribe-unlabelled** situations that pit the pair's
 * values against each other. The options are never mapped to a tribe — the scored
 * signal is the trade-off plus the free-text "why" — so these are framing content,
 * not a scoring key.
 */
const DILEMMA_BANK: Record<string, Omit<Dilemma, "pair">> = {
  "benjamin|judah": {
    id: "benjamin-judah-front",
    prompt: "Your group is heading into something hard, and two roles are open. Which pull is stronger?",
    optionA:
      "Being the one others turn to for the call — out front, carrying the decision and the blame if it goes wrong, where everyone can see.",
    optionB:
      "Being the one sent to break whatever is blocking the group — the riskiest piece of the job, done whether or not anyone is watching.",
  },
  "levi|simeon": {
    id: "levi-simeon-sacred",
    prompt: "Something you hold sacred is being treated carelessly by the people around you.",
    optionA:
      "You stay and keep tending it — holding the room, teaching, drawing people back toward what matters by your steady presence.",
    optionB:
      "You confront it directly, right now, even if the room turns on you, because letting it slide would be the real betrayal.",
  },
  "asher|naphtali": {
    id: "asher-naphtali-stuck",
    prompt: "Someone close to you is stuck and hurting, and you want to help.",
    optionA:
      "You build a place around them where they can rest and be fed until they are steady again — you stay put and make it warm.",
    optionB:
      "You get them moving — out of the situation and toward something freer — even if it means leaving comfort behind for you both.",
  },
  "dan|issachar": {
    id: "dan-issachar-offplan",
    prompt: "You sense something is off about a plan everyone else is excited about.",
    optionA:
      "You study it — the patterns, the history, the timing — until you can say clearly what it means and when to move.",
    optionB:
      "You watch for the hidden trap others are missing, assume someone may be working an angle, and guard against it early.",
  },
  "gad|joseph": {
    id: "gad-joseph-grind",
    prompt: "The work has become a long grind with no end in sight.",
    optionA:
      "You settle in, bring order to the chaos, and carry it steadily for as long as it takes, composed under the weight.",
    optionB:
      "You push harder into the worst of it, take the ground no one else will, and refuse to stop even when you are past empty.",
  },
};

/**
 * A neutral trade-off used when no pair-specific Dilemma is authored. Still
 * tribe-unlabelled; the "why" is what the scorer reads.
 */
const GENERIC_DILEMMA: Omit<Dilemma, "pair"> = {
  id: "generic-tradeoff",
  prompt: "Two things you care about are pulling against each other, and you can act on only one.",
  optionA: "You protect what is steady and proven, even if it means passing up something new and untested.",
  optionB: "You reach for what could be, even if it risks what is already working.",
};

/**
 * The Dilemma to pose for a tied Contender pair: the authored one for that pair
 * if the bank has it, else a neutral generic trade-off. Argument order does not
 * matter — the pair is normalized to look up and to report.
 */
export function pickDilemma(pair: [string, string]): Dilemma {
  const key = pairKey(pair[0], pair[1]);
  const template = DILEMMA_BANK[`${key[0]}|${key[1]}`] ?? GENERIC_DILEMMA;
  return { ...template, pair: key };
}

export interface PlanInput {
  /** Turns completed *after* folding in the just-answered Turn. */
  turnsCompleted: number;
  /** The running profile after the just-answered Turn. */
  profile: StrengthProfile;
  /** The score trace after the just-answered Turn. */
  trace: readonly ScoreTraceEntry[];
  /** Whether the Turn just answered was itself a Dilemma (no back-to-back Dilemmas). */
  lastTurnWasDilemma: boolean;
  /** The agent's steered next-question proposal, or null if it proposed none. */
  proposedQuestion: string | null;
}

/**
 * Decide the next pending Turn. Calibration serves its fixed opening questions in
 * order (ignoring any model proposal); Discrimination deploys a Dilemma for a
 * stubborn tie, otherwise asks the agent's steered question (or an authored
 * fallback). Never two Dilemmas in a row.
 */
export function planNextTurn(input: PlanInput): PendingTurn {
  const { turnsCompleted, profile, trace, lastTurnWasDilemma, proposedQuestion } = input;

  if (phaseFor(turnsCompleted) === "calibration") {
    const prompt =
      CALIBRATION_QUESTIONS[turnsCompleted] ??
      CALIBRATION_QUESTIONS[CALIBRATION_QUESTIONS.length - 1];
    return { kind: "question", phase: "calibration", prompt };
  }

  if (!lastTurnWasDilemma) {
    const pair = stubbornTie(profile, trace, turnsCompleted);
    if (pair) {
      return { kind: "dilemma", phase: "discrimination", dilemma: pickDilemma(pair) };
    }
  }

  const prompt =
    proposedQuestion ??
    DISCRIMINATION_FALLBACKS[
      (turnsCompleted - CALIBRATION_TURNS) % DISCRIMINATION_FALLBACKS.length
    ];
  return { kind: "question", phase: "discrimination", prompt };
}
