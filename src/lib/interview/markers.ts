// The Marker Catalog: the rubric the Interview scores against (ADR 0003, 0010).
//
// Server-only by construction. The catalog is a scoring concern behind a trust
// boundary (ADR 0009) — it must never ship to the client, where exposing the
// word→tribe mapping would make the instrument gameable. The `server-only`
// import makes a client-bundle import a build error. Kept deliberately separate
// from `tribes.ts`, which is the client-facing render source of truth (ADR 0010).
//
// Markers are *hand-distilled* from each tribe's `strengths` / `oil` / `shadow`
// / `fallLine` prose in `tribes.ts` — this is where the instrument's rigor lives,
// not in the prompt. Coverage is **even** across all 12 tribes (ADR 0010):
// every tribe gets the same MARKERS_PER_TRIBE markers spanning all four types,
// so none is harder to surface. A future reader should not "normalize" the
// catalog to the uneven word-list proportions.
import "server-only";

import { tribes } from "../tribes";

/** Which profile field a Marker is distilled from (CONTEXT.md "Marker Type"). */
export const MARKER_TYPES = ["strength", "oil", "shadow", "fallLine"] as const;
export type MarkerType = (typeof MARKER_TYPES)[number];

/**
 * A concrete, observable signal distilled from a tribe's profile that an answer
 * can be mapped to, carrying a bounded weight toward that tribe's strength
 * (CONTEXT.md "Marker"). Every strength delta the agent assigns must cite one.
 */
export interface Marker {
  /** Stable, citable id used in the score trace. Prefixed with the tribe slug. */
  id: string;
  /** Tribe this Marker belongs to; validated against `tribes.ts`. */
  tribeSlug: string;
  /** Which profile field it was distilled from. */
  type: MarkerType;
  /** The observable thing, in plain first-person-recognisable language. */
  signal: string;
  /** Bounded weight toward strength; shadow/fall-line weigh higher (ADR 0004). */
  weight: number;
  /** A snippet of what resonance looks like, to anchor the agent. */
  exemplar?: string;
  /** A snippet that looks similar but should NOT fire, to curb false positives. */
  counterExemplar?: string;
}

/** Even-coverage target: every tribe gets exactly this many Markers (ADR 0010). */
export const MARKERS_PER_TRIBE = 5;

/** Weight bounds. shadow/fall-line are the most bias-resistant signals (ADR 0004). */
export const MIN_WEIGHT = 0; // exclusive
export const MAX_WEIGHT = 2; // inclusive

const STRENGTH_WEIGHT = 1;
const OIL_WEIGHT = 1;
// Shadow / fall-line weigh higher: people do not fake their weaknesses to look
// like a tribe, so these are the most bias-resistant evidence (CONTEXT.md).
const SHADOW_WEIGHT = 1.5;
const FALL_LINE_WEIGHT = 1.5;

export const markerCatalog: Marker[] = [
  // ── Judah · The Lion — Honor · Courage · Authority ──────────────────────
  {
    id: "judah-strength-frontline",
    tribeSlug: "judah",
    type: "strength",
    signal: "Steps to the front and absorbs the burden in a crisis — leads the charge rather than observing it.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Volunteers for the hardest assignment and carries the weight publicly.",
  },
  {
    id: "judah-strength-authority",
    tribeSlug: "judah",
    type: "strength",
    signal: "Naturally carries honor and authority; comfortable being looked to as the one in charge.",
    weight: STRENGTH_WEIGHT,
    exemplar: "People default to following them; they bear public responsibility without flinching.",
  },
  {
    id: "judah-oil-weight",
    tribeSlug: "judah",
    type: "oil",
    signal: "Comes alive when more responsibility and pressure are piled on — wants the ball in the fourth quarter.",
    weight: OIL_WEIGHT,
    exemplar: "Seeks out the high-stakes moment instead of avoiding it; thrives under added duty.",
  },
  {
    id: "judah-shadow-insignificance",
    tribeSlug: "judah",
    type: "shadow",
    signal: "Driven by a fear of being insignificant or losing influence; equates being seen with mattering.",
    weight: SHADOW_WEIGHT,
    exemplar: "Feels a quiet dread when overlooked; chases visibility to feel significant.",
    counterExemplar: "Confident, settled leadership that doesn't need an audience is the strength, not this shadow.",
  },
  {
    id: "judah-fallline-power",
    tribeSlug: "judah",
    type: "fallLine",
    signal: "Uses position or appetite for self — overrides others or takes what isn't theirs because the role grants access.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with the pull to bend the rules once power is in hand, whether or not they act on it now.",
    counterExemplar: "Holding authority with restraint and accountability is integration, not the fall line.",
  },

  // ── Levi · The Priest — Worship · Teaching · Consecration ───────────────
  {
    id: "levi-strength-consecration",
    tribeSlug: "levi",
    type: "strength",
    signal: "Set apart and consecrated; instinctively guards what is holy and will defend sacred things.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Feels like an outsider by design and is fiercely protective of what is sacred.",
  },
  {
    id: "levi-strength-teaching",
    tribeSlug: "levi",
    type: "strength",
    signal: "Teaches and explains truth; mediates between the holy and the people — what pleases God is their native language.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Drawn to instruct and consecrate; helps others understand and approach the sacred.",
  },
  {
    id: "levi-oil-encounter",
    tribeSlug: "levi",
    type: "oil",
    signal: "Comes alive in direct, unmediated encounter with God's presence rather than in managing rules about it.",
    weight: OIL_WEIGHT,
    exemplar: "Their worship is firsthand access, not enforcement of protocol — they want the room, not the door.",
  },
  {
    id: "levi-shadow-legalism",
    tribeSlug: "levi",
    type: "shadow",
    signal: "Slides into legalism, spiritual elitism, or severity — measuring others by rule-keeping.",
    weight: SHADOW_WEIGHT,
    exemplar: "Reflexively judges who's in and who's out by how strictly they keep the standard.",
    counterExemplar: "High personal holiness that stays warm and welcoming is the strength, not this shadow.",
  },
  {
    id: "levi-fallline-gatekeeping",
    tribeSlug: "levi",
    type: "fallLine",
    signal: "Charges admission to God — uses scripture as a weapon and keeps the form while the relationship is gone.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with putting a price on holiness or wielding the Bible to control others.",
    counterExemplar: "Teaching truth with mercy and open access is integration, not gatekeeping.",
  },

  // ── Issachar · The Sage — Discernment · Timing · Wisdom ─────────────────
  {
    id: "issachar-strength-timing",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Obsessed with timing and moments; reads the cultural moment to know what should be done.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Senses when the season has shifted and what the right response to it is.",
  },
  {
    id: "issachar-strength-discernment",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Studies history and underlying patterns, then translates them into clear instruction for others.",
    weight: STRENGTH_WEIGHT,
    exemplar: "A student of patterns who tells people not just what is happening but what to do about it.",
  },
  {
    id: "issachar-oil-partnership",
    tribeSlug: "issachar",
    type: "oil",
    signal: "Seeks understanding in partnership with God rather than from analysis alone.",
    weight: OIL_WEIGHT,
    exemplar: "Goes straight to God for interpretation; their discernment runs at full capacity when sourced rightly.",
  },
  {
    id: "issachar-shadow-overanalysis",
    tribeSlug: "issachar",
    type: "shadow",
    signal: "Over-analyzes and must have all risk eliminated before acting; looks to trends or astrology when disconnected.",
    weight: SHADOW_WEIGHT,
    exemplar: "Stalls on a decision until every variable is resolved; reads the times from any source but God.",
    counterExemplar: "Careful, well-sourced discernment that still acts is the strength, not this shadow.",
  },
  {
    id: "issachar-fallline-cowardice",
    tribeSlug: "issachar",
    type: "fallLine",
    signal: "Sees clearly but stays silent or slow — fear of misreading the moment freezes them into doing nothing.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with knowing the right call yet holding back out of fear of being wrong.",
    counterExemplar: "Waiting on purpose for the right timing, then speaking, is wisdom — not this paralysis.",
  },

  // ── Zebulun · The Merchant — Enterprise · Abundance · Influence ─────────
  {
    id: "zebulun-strength-enterprise",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Generates abundance and enterprise; turns resources into influence and expansion.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Naturally creates increase and sees the opportunity to build something that grows.",
  },
  {
    id: "zebulun-strength-mobilize",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Mobilizes resources and draws people into a vision — built to go out and create.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Gathers the people and means to make a thing happen and pulls others into it.",
  },
  {
    id: "zebulun-oil-generosity",
    tribeSlug: "zebulun",
    type: "oil",
    signal: "Thrives when circulating what they generate — asking what to multiply, not what to keep.",
    weight: OIL_WEIGHT,
    exemplar: "Gives things away to keep momentum; stewards the flow rather than hoarding it.",
  },
  {
    id: "zebulun-shadow-halfobedience",
    tribeSlug: "zebulun",
    type: "shadow",
    signal: "Settles for half-obedience — stops short of the full assignment, tolerating compromise in the very area they're gifted in.",
    weight: SHADOW_WEIGHT,
    exemplar: "Drives out most of the problem but leaves a lucrative corner of it standing.",
    counterExemplar: "Diligent stewardship that finishes the assignment is the strength, not this shadow.",
  },
  {
    id: "zebulun-fallline-greed",
    tribeSlug: "zebulun",
    type: "fallLine",
    signal: "Reduces everything to financial return — monetizes what was never meant to have a price.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with measuring people and callings by their profitability.",
    counterExemplar: "Valuing prosperity as a tool for the mission is the gift, not the fall.",
  },

  // ── Joseph · The Bull — Resilience · Order · Fortitude ──────────────────
  {
    id: "joseph-strength-resilience",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Maintains fortitude and steadiness in hostile, predatory environments; forged through pain.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Keeps functioning and holds the line when betrayed, demoted, or under sustained pressure.",
  },
  {
    id: "joseph-strength-administration",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Administrates and brings order at scale, often as a trusted second-in-command serving someone else's mission.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Runs the operation behind the scenes and makes another person's vision work.",
  },
  {
    id: "joseph-oil-companionship",
    tribeSlug: "joseph",
    type: "oil",
    signal: "Stays warm and connected when witnessed and valued as a person in the labor, not just used for outcomes.",
    weight: OIL_WEIGHT,
    exemplar: "Needs someone who affirms their integrity in the pit, not applause for results.",
  },
  {
    id: "joseph-shadow-coldness",
    tribeSlug: "joseph",
    type: "shadow",
    signal: "Lets pain harden them into coldness, bitterness, or cynicism; holds resentment rather than processing it.",
    weight: SHADOW_WEIGHT,
    exemplar: "Goes emotionally distant and keeps a private ledger of grievances after being hurt.",
    counterExemplar: "Steady composure under pressure is the strength; this is the chill that follows unprocessed pain.",
  },
  {
    id: "joseph-fallline-detachment",
    tribeSlug: "joseph",
    type: "fallLine",
    signal: "Cuts off from connection and God so resilience curdles into isolation and emotional shutdown.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with going fully self-contained and numb, fed by no one and feeding no one.",
    counterExemplar: "Healthy solitude that stays connected to a source is not this collapse.",
  },

  // ── Benjamin · The Wolf — Ferocity · Loyalty · Cunning ──────────────────
  {
    id: "benjamin-strength-ferocity",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Fierce and intense; comes alive in hard places and treats every situation as winnable.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Drop them into a hard spot and they sharpen rather than shrink.",
  },
  {
    id: "benjamin-strength-loyalty",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Fiercely protective and loyal to their people; reads culture and danger with cunning.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Will stand as a rock for their pack and senses threats to them early.",
  },
  {
    id: "benjamin-oil-mission",
    tribeSlug: "benjamin",
    type: "oil",
    signal: "Channels their fight best when given a clear, God-given enemy or mission — a hill to take.",
    weight: OIL_WEIGHT,
    exemplar: "Most dangerous and most settled when pointed at a righteous, well-defined target.",
  },
  {
    id: "benjamin-shadow-vulnerability",
    tribeSlug: "benjamin",
    type: "shadow",
    signal: "Avoids ever appearing weak, foolish, or afraid; becomes intimidating and impulsive.",
    weight: SHADOW_WEIGHT,
    exemplar: "Covers any sign of weakness with intensity; picks fights to avoid looking soft.",
    counterExemplar: "Courageous intensity aimed at a real threat is the strength, not this fear of being seen weak.",
  },
  {
    id: "benjamin-fallline-devour",
    tribeSlug: "benjamin",
    type: "fallLine",
    signal: "Can't turn the warfare off, so the ferocity turns on the people and things they were meant to protect.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with fighting a war no one commissioned and consuming their own when threatened.",
    counterExemplar: "Fierce protection within a real mission is the gift; devouring the pack is the fall.",
  },

  // ── Dan · The Serpent — Vigilance · Strategy · Discernment ──────────────
  {
    id: "dan-strength-vigilance",
    tribeSlug: "dan",
    type: "strength",
    signal: "The watchman — strategically vigilant; reads threats and the room before anyone else does.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Notices the danger or the angle that everyone else missed, and early.",
  },
  {
    id: "dan-strength-discernment",
    tribeSlug: "dan",
    type: "strength",
    signal: "Sees what others miss through predatory intelligence and pattern recognition; keen positional awareness.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Quick reflexes for reading motives and positioning; the sentinel at the gate.",
  },
  {
    id: "dan-oil-trust",
    tribeSlug: "dan",
    type: "oil",
    signal: "At their best when they trust God's faithfulness rather than their own vigilance.",
    weight: OIL_WEIGHT,
    exemplar: "Lets go of control and becomes a wise counselor instead of a suspicious sentry.",
  },
  {
    id: "dan-shadow-cynicism",
    tribeSlug: "dan",
    type: "shadow",
    signal: "Fear of being deceived hardens discernment into cynicism and suspicion; bitterness draws other cynics in.",
    weight: SHADOW_WEIGHT,
    exemplar: "Assumes the worst, looks for the angle, and collects fellow skeptics.",
    counterExemplar: "Sharp, accurate threat-reading held with trust is the strength, not this corrosive suspicion.",
  },
  {
    id: "dan-fallline-counterfeit",
    tribeSlug: "dan",
    type: "fallLine",
    signal: "Builds a counterfeit or idol when the real thing feels out of reach — discernment weaponized into deception.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with sowing doubt ('did God really say?') or erecting a convenient substitute.",
    counterExemplar: "Discernment used to protect and build truth is the gift, not this corruption.",
  },

  // ── Naphtali · The Deer — Freedom · Beauty · Healing ────────────────────
  {
    id: "naphtali-strength-freedom",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Brings freedom and lightness to others; gifted in beauty, expression, and encouragement.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Their presence loosens what is bound; they create beauty that lifts people.",
  },
  {
    id: "naphtali-strength-healing",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Heals others out of their own surrendered pain — went through it first, so oversees transitions and recovery.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Their hardest seasons, surrendered, become the very thing that frees other people.",
  },
  {
    id: "naphtali-oil-mission",
    tribeSlug: "naphtali",
    type: "oil",
    signal: "Thrives when their movement toward freedom is commissioned as ministry for others rather than flight for themselves.",
    weight: OIL_WEIGHT,
    exemplar: "Given permission and structure, their speed and beauty carry others out, not just themselves.",
  },
  {
    id: "naphtali-shadow-avoidance",
    tribeSlug: "naphtali",
    type: "shadow",
    signal: "Avoids pain and heaviness — the very thing that qualifies them — and rejects others before being rejected.",
    weight: SHADOW_WEIGHT,
    exemplar: "Bolts from captivity and weight; keeps people at arm's length to pre-empt their rejection.",
    counterExemplar: "Moving lightly toward others in freedom is the strength, not this flight from pain.",
  },
  {
    id: "naphtali-fallline-escapism",
    tribeSlug: "naphtali",
    type: "fallLine",
    signal: "Runs — the gift of beauty and expression turns inward and self-serving, becoming escapism instead of healing.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with self-expression that is about them rather than the people they were sent to heal.",
    counterExemplar: "Expression that carries others to freedom is the gift, not this inward turn.",
  },

  // ── Asher · The Olive Tree — Hospitality · Nourishment · Generosity ─────
  {
    id: "asher-strength-hospitality",
    tribeSlug: "asher",
    type: "strength",
    signal: "Creates warm, enriching atmospheres where people are fed, welcomed, and cared for.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Rooms change when they host; people feel nourished in their presence.",
  },
  {
    id: "asher-strength-generosity",
    tribeSlug: "asher",
    type: "strength",
    signal: "Generous and nourishing by instinct; gives in order to make others flourish.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Reaches for the way to feed and enrich whoever is in front of them.",
  },
  {
    id: "asher-oil-atmosphere",
    tribeSlug: "asher",
    type: "oil",
    signal: "Comes alive creating an environment that nourishes others — that's where they find purpose and energy.",
    weight: OIL_WEIGHT,
    exemplar: "Most themselves when building a place where others are enriched and fed.",
  },
  {
    id: "asher-shadow-comfort",
    tribeSlug: "asher",
    type: "shadow",
    signal: "Slides into comfort, passivity, or over-indulgence; people-pleases to feel better about themselves.",
    weight: SHADOW_WEIGHT,
    exemplar: "Chooses ease over engagement and seeks approval more than the other person's good.",
    counterExemplar: "Generous service that costs them is the strength, not this self-soothing comfort.",
  },
  {
    id: "asher-fallline-scarcity",
    tribeSlug: "asher",
    type: "fallLine",
    signal: "A scarcity mindset drives retreat and friction-avoidance — the peacemaker becomes the enabler.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with hoarding from insecurity and smoothing over what needed confronting.",
    counterExemplar: "Generous peace that still names hard truth is the gift, not this enabling retreat.",
  },

  // ── Gad · The Raider — Grit · Endurance · Resistance ────────────────────
  {
    id: "gad-strength-grit",
    tribeSlug: "gad",
    type: "strength",
    signal: "Frontline grit — endures, resists, and rebuilds under pressure without quitting.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Takes a hit and raids back at their heels; will not be the one who quits.",
  },
  {
    id: "gad-strength-hardground",
    tribeSlug: "gad",
    type: "strength",
    signal: "Drawn to the hard places and forgotten ground no one else will go to; built to survive.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Volunteers for the assignment everyone else avoids and crosses the river in flood.",
  },
  {
    id: "gad-oil-rest",
    tribeSlug: "gad",
    type: "oil",
    signal: "Restored by rest — the thing they resist most is the thing that keeps them functioning.",
    weight: OIL_WEIGHT,
    exemplar: "Receives bread and rest as survival, not betrayal, and is renewed by it.",
  },
  {
    id: "gad-shadow-overwhelm",
    tribeSlug: "gad",
    type: "shadow",
    signal: "Haunted by a fear of collapse or being overwhelmed — ironic for the one built to endure.",
    weight: SHADOW_WEIGHT,
    exemplar: "Pushes harder precisely because the dread of buckling never quite leaves.",
    counterExemplar: "Steady endurance held with rest is the strength, not this fear-driven overdrive.",
  },
  {
    id: "gad-fallline-burnout",
    tribeSlug: "gad",
    type: "fallLine",
    signal: "Treats rest as betrayal and never stops, driving to burnout and collapse.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with running until they break because stopping feels like letting people down.",
    counterExemplar: "Sustainable endurance that accepts rest is integration, not this collapse.",
  },

  // ── Reuben · The Firstborn — Potential · Leadership · Capacity ──────────
  {
    id: "reuben-strength-potential",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Carries unusual capacity and the firstborn anointing — wired to lead and to carry the blessing.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Has more raw capacity and potential than almost anyone in the room.",
  },
  {
    id: "reuben-strength-instinct",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Right leadership instincts; senses what should be done and feels the pull to carry responsibility.",
    weight: STRENGTH_WEIGHT,
    exemplar: "The first instinct is sound — they see the right move even when they're slow to make it.",
  },
  {
    id: "reuben-oil-constraint",
    tribeSlug: "reuben",
    type: "oil",
    signal: "Grows when a respected mentor frames constraint as initiation into greater authority, not punishment.",
    weight: OIL_WEIGHT,
    exemplar: "Receives limitation from someone they trust as a path to more influence, and holds it.",
  },
  {
    id: "reuben-shadow-instability",
    tribeSlug: "reuben",
    type: "shadow",
    signal: "Unstable and impulsive; over-zealous with no container, giving away authority through lack of restraint.",
    weight: SHADOW_WEIGHT,
    exemplar: "Turbulent as water — bursts of zeal without the structure to hold them.",
    counterExemplar: "Bold initiative held within a container is the strength, not this unrestrained volatility.",
  },
  {
    id: "reuben-fallline-forfeit",
    tribeSlug: "reuben",
    type: "fallLine",
    signal: "Forfeits the blessing through lack of self-control — the most to gain, lost through what they couldn't restrain.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with squandering a real anointing by an appetite they wouldn't govern, or arriving too late.",
    counterExemplar: "Great capacity held under mentored constraint is redemption, not this forfeiture.",
  },

  // ── Simeon · The Blade — Conviction · Zeal · Justice ────────────────────
  {
    id: "simeon-strength-conviction",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Passionate, action-oriented conviction and zeal for holiness — moves decisively on what matters.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Sees what is wrong and acts on it with committed, wholehearted conviction.",
  },
  {
    id: "simeon-strength-attunement",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Deeply attuned to God's voice and to what matters — the buried gift of 'hearing'.",
    weight: STRENGTH_WEIGHT,
    exemplar: "Hears and discerns what is sacred and at stake before others register it.",
  },
  {
    id: "simeon-oil-mercy",
    tribeSlug: "simeon",
    type: "oil",
    signal: "Matures when conviction is infused with mercy — judgment that has learned the heart behind the law.",
    weight: OIL_WEIGHT,
    exemplar: "Speaks a hard word with love and care, letting mercy triumph over judgment.",
  },
  {
    id: "simeon-shadow-nomercy",
    tribeSlug: "simeon",
    type: "shadow",
    signal: "Conviction with zero mercy — grasps the rules but not their intent; without structure the blade has no direction.",
    weight: SHADOW_WEIGHT,
    exemplar: "Throws the baby out with the bathwater, applying the rule with no room for the person.",
    counterExemplar: "Firm conviction tempered by mercy is the strength, not this merciless severity.",
  },
  {
    id: "simeon-fallline-cruelty",
    tribeSlug: "simeon",
    type: "fallLine",
    signal: "Conviction curdles into cruelty without balance — even using deception to enable harm in the name of being right.",
    weight: FALL_LINE_WEIGHT,
    exemplar: "Resonates with an anger so fierce it justifies harming others to enforce what they're sure is right.",
    counterExemplar: "Zeal that waits, discerns, and blesses is redemption, not this cruelty.",
  },
];

const validSlugs = new Set(tribes.map((t) => t.slug));

/** Markers belonging to one tribe, in catalog order. */
export function getMarkersForTribe(slug: string): Marker[] {
  return markerCatalog.filter((m) => m.tribeSlug === slug);
}

/** Count of Markers per tribe slug, with every tribe present (0 if uncovered). */
export function markerCountsByTribe(catalog: Marker[] = markerCatalog): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tribes) counts.set(t.slug, 0);
  for (const m of catalog) counts.set(m.tribeSlug, (counts.get(m.tribeSlug) ?? 0) + 1);
  return counts;
}

/** Throws if any Marker references a slug not present in `tribes.ts`. */
export function validateMarkerSlugs(catalog: Marker[]): void {
  for (const m of catalog) {
    if (!validSlugs.has(m.tribeSlug)) {
      throw new Error(`Marker "${m.id}" references unknown tribe slug "${m.tribeSlug}"`);
    }
  }
}

/** Throws if any Marker id repeats. */
export function validateUniqueIds(catalog: Marker[]): void {
  const seen = new Set<string>();
  for (const m of catalog) {
    if (seen.has(m.id)) throw new Error(`Duplicate marker id "${m.id}"`);
    seen.add(m.id);
  }
}

/** Throws if any Marker weight falls outside `(MIN_WEIGHT, MAX_WEIGHT]`. */
export function validateWeights(catalog: Marker[]): void {
  for (const m of catalog) {
    if (!(m.weight > MIN_WEIGHT && m.weight <= MAX_WEIGHT)) {
      throw new Error(
        `Marker "${m.id}" weight ${m.weight} is out of bounds (${MIN_WEIGHT}, ${MAX_WEIGHT}]`,
      );
    }
  }
}

/**
 * Throws unless every tribe has at least one Marker of each of the four types.
 * Enforces that all four profile fields are represented per tribe (ADR 0004).
 */
export function validateTypeCoverage(catalog: Marker[]): void {
  const byTribe = new Map<string, Set<MarkerType>>();
  for (const m of catalog) {
    const set = byTribe.get(m.tribeSlug) ?? new Set<MarkerType>();
    set.add(m.type);
    byTribe.set(m.tribeSlug, set);
  }
  for (const t of tribes) {
    const types = byTribe.get(t.slug);
    for (const type of MARKER_TYPES) {
      if (!types?.has(type)) {
        throw new Error(`Tribe "${t.slug}" is missing a "${type}" marker`);
      }
    }
  }
}

/**
 * Throws unless coverage is even across all 12 tribes (ADR 0010): every tribe
 * present, and the spread between the most- and least-covered tribe is within
 * `tolerance` (default 0 — exactly even).
 */
export function validateEvenCoverage(catalog: Marker[], tolerance = 0): void {
  const counts = markerCountsByTribe(catalog);
  for (const [slug, n] of counts) {
    if (n === 0) throw new Error(`Tribe "${slug}" has no markers`);
  }
  const values = [...counts.values()];
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > tolerance) {
    throw new Error(
      `Uneven marker coverage: spread of ${spread} exceeds tolerance ${tolerance}`,
    );
  }
}

/** Runs every catalog invariant. Defaults to the authored `markerCatalog`. */
export function validateMarkerCatalog(catalog: Marker[] = markerCatalog): void {
  validateUniqueIds(catalog);
  validateMarkerSlugs(catalog);
  validateWeights(catalog);
  validateTypeCoverage(catalog);
  validateEvenCoverage(catalog);
}

// Fail loudly at module load so authoring mistakes can never drift into the app.
validateMarkerCatalog();
