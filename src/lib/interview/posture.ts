import type { NotablePerson, Tribe, TribeStatus } from "@/lib/tribes";
import { statusLabels } from "@/lib/tribes";
import type { PostureReading } from "./types";

/**
 * Posture framing for the Interview result (ADR-0004/0007) — client-safe,
 * pure copy with no scoring in it. Scoring is status-blind, so a disqualified
 * or warning tribe can be a participant's Primary; this module turns the
 * tribe's `status` plus the participant's Posture on its arc into
 * non-condemning copy. Active-shadow gets the cautionary reading, integrated the
 * redemption reading, and both point to a redeemed exemplar already in the
 * tribe's content.
 */

/** Short display label for each Posture reading. */
export const POSTURE_LABELS: Record<PostureReading, string> = {
  integrated: "Integrated",
  mixed: "Mixed",
  "active-shadow": "Active shadow",
  unread: "Not yet read",
};

/**
 * The redeemed exemplar for each non-`active` tribe, by `notablePeople` name.
 * Tests check each one exists in `tribes.ts`, so a renamed entry fails loudly.
 */
export const REDEEMED_EXEMPLARS: Record<string, string> = {
  dan: "Nehemiah",
  gad: "Elijah",
  reuben: "Caleb",
  simeon: "Simeon the Righteous",
};

/** What a tribe's status means in Scripture, phrased as the tribe's story, not a verdict. */
const STATUS_COPY: Record<Exclude<TribeStatus, "active">, (name: string) => string> = {
  disqualified: (name) =>
    `In the biblical narrative, ${name} is missing from Revelation 7's 144,000. That is the story of a tribe, not a judgement on you: the wiring itself is real and common, and restoration is part of its story (Ezekiel 48).`,
  warning: (name) =>
    `${name} is a warning tribe in Scripture: its fruit warns those around it. That is a direction to keep moving in, not a verdict on you.`,
  "disqualified-arc": (name) =>
    `${name} carries a hard historical arc in Scripture. That is the story of a tribe, not a sentence on you, and the same wiring has a redemption arc too.`,
};

export type FramingTone = "redemption" | "cautionary" | "open";

export interface StatusFraming {
  /** The tribe's status label, e.g. "Disqualified". */
  label: string;
  /** What the status means in the narrative, phrased non-condemningly. */
  status: string;
  /** Where the participant's Posture places them on the tribe's arc. */
  arc: string;
  tone: FramingTone;
  exemplar?: NotablePerson;
}

/**
 * Non-condemning, arc-aware framing for a Primary whose tribe is not `active`,
 * or null for an active tribe (nothing to frame).
 */
export function statusFraming(tribe: Tribe, reading: PostureReading): StatusFraming | null {
  if (tribe.status === "active") return null;

  const exemplar = tribe.notablePeople.find((p) => p.name === REDEEMED_EXEMPLARS[tribe.slug]);
  const who = exemplar ? `${exemplar.name} (${exemplar.reference})` : `the tribe's redeemed exemplars`;

  const byReading: Record<PostureReading, { tone: FramingTone; arc: string }> = {
    integrated: {
      tone: "redemption",
      arc: `Your answers lean toward the integrated end of this arc: you described the tendency from the far side of it. That is the redemption reading. ${who} shows this wiring redeemed.`,
    },
    "active-shadow": {
      tone: "cautionary",
      arc: `Your answers lean toward the shadow end of this arc right now. Read this as a caution, not a condemnation: the pattern is named so it can be surrendered, and ${who} shows where the same wiring can go.`,
    },
    mixed: {
      tone: "open",
      arc: `Your answers show both sides of this arc: some of the tendency still live, some of it grown through. ${who} shows where the arc leads.`,
    },
    unread: {
      tone: "open",
      arc: `The Interview didn't hear enough about this tribe's shadow or its oil to place you on its arc. ${who} shows what this wiring looks like redeemed.`,
    },
  };

  return {
    label: statusLabels[tribe.status],
    status: STATUS_COPY[tribe.status](tribe.name),
    ...byReading[reading],
    exemplar,
  };
}
