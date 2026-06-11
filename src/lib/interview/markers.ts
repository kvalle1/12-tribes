import "server-only";

import { tribes } from "@/lib/tribes";

/**
 * The Marker Catalog — the rubric the Interview scores against (ADR 0003, 0010).
 *
 * Markers are hand-distilled from each tribe's `strengths` / `oil` /
 * `shadowConstraints` / `fallLine` prose in `tribes.ts`, kept in this separate,
 * server-only module: `tribes.ts` is the client-facing render source of truth,
 * while the catalog is a scoring concern that must never reach the client
 * (ADR 0009 trust boundary). The `server-only` import above makes importing this
 * module from a Client Component a build error.
 *
 * Coverage is deliberately *even* across all 12 tribes — every tribe gets the
 * same number of Markers, spanning all four types — so that no tribe is harder
 * to surface than another (ADR 0010, breaking the uneven word-list precedent).
 */

/** Which field of a tribe's profile a Marker is distilled from. */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

export const MARKER_TYPES = ["strength", "oil", "shadow", "fallLine"] as const;

/** Weights are bounded; shadow / fall-line may weight higher (ADR 0010). */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 3;

/** Max allowed spread between the most- and least-covered tribe. */
export const COVERAGE_TOLERANCE = 1;

export interface Marker {
  /** Stable, citable id used in the score trace, e.g. `judah-strength-1`. */
  id: string;
  /** Tribe this Marker belongs to; validated against `tribes.ts`. */
  tribeSlug: string;
  /** Which profile field it is distilled from. */
  type: MarkerType;
  /** The observable thing in plain language. */
  signal: string;
  /** Bounded contribution toward the tribe's strength. */
  weight: number;
  /** A snippet that anchors the agent to a true positive. */
  exemplar?: string;
  /** A snippet that curbs the conceptual-vs-lived false positive. */
  counterExemplar?: string;
}

const judah: Marker[] = [
  {
    id: "judah-strength-1",
    tribeSlug: "judah",
    type: "strength",
    signal: "Steps to the front and takes public responsibility for outcomes rather than observing from safety.",
    weight: 2,
    exemplar: "Volunteers to lead the hardest effort and stands accountable for how it lands.",
  },
  {
    id: "judah-strength-2",
    tribeSlug: "judah",
    type: "strength",
    signal: "Carries authority naturally — others look to them to make the call.",
    weight: 1,
  },
  {
    id: "judah-strength-3",
    tribeSlug: "judah",
    type: "strength",
    signal: "Energized by burden and high-stakes pressure; wants the decisive moment.",
    weight: 1,
    exemplar: "Says they want the ball in the fourth quarter.",
  },
  {
    id: "judah-oil-1",
    tribeSlug: "judah",
    type: "oil",
    signal: "Comes alive when more weight and duty are placed on their shoulders.",
    weight: 2,
    counterExemplar: "Prefers a low-stakes role where no one is depending on them.",
  },
  {
    id: "judah-shadow-1",
    tribeSlug: "judah",
    type: "shadow",
    signal: "Fears insignificance and losing influence; equates visibility with significance.",
    weight: 2,
    exemplar: "Becomes anxious or restless when out of the spotlight or sidelined.",
  },
  {
    id: "judah-fallLine-1",
    tribeSlug: "judah",
    type: "fallLine",
    signal: "Uses position to consume what belongs to others — abuse of power or entitlement over people.",
    weight: 3,
  },
];

const levi: Marker[] = [
  {
    id: "levi-strength-1",
    tribeSlug: "levi",
    type: "strength",
    signal: "Guards and defends what is sacred; ruthless about protecting holy things.",
    weight: 2,
  },
  {
    id: "levi-strength-2",
    tribeSlug: "levi",
    type: "strength",
    signal: "Drawn to teach and explain what is right; mediates between the divine and others.",
    weight: 1,
  },
  {
    id: "levi-strength-3",
    tribeSlug: "levi",
    type: "strength",
    signal: "Feels set apart and consecrated — comfortable being an outsider by design.",
    weight: 1,
  },
  {
    id: "levi-oil-1",
    tribeSlug: "levi",
    type: "oil",
    signal: "Most alive in direct, unmediated encounter with God rather than managing rules about Him.",
    weight: 2,
    counterExemplar: "Satisfied administering religious protocol without any personal encounter.",
  },
  {
    id: "levi-shadow-1",
    tribeSlug: "levi",
    type: "shadow",
    signal: "Slides into legalism and spiritual elitism — severity and rule-keeping over heart.",
    weight: 2,
  },
  {
    id: "levi-fallLine-1",
    tribeSlug: "levi",
    type: "fallLine",
    signal: "Uses scripture and standards as a weapon and gatekeeps access to God — religion without relationship.",
    weight: 3,
  },
];

const issachar: Marker[] = [
  {
    id: "issachar-strength-1",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Reads timing and 'the moment' — senses what should be done now.",
    weight: 2,
  },
  {
    id: "issachar-strength-2",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Recognizes patterns and studies history to interpret the present.",
    weight: 1,
  },
  {
    id: "issachar-strength-3",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Goes straight to the source for understanding before instructing others on what to do.",
    weight: 1,
  },
  {
    id: "issachar-oil-1",
    tribeSlug: "issachar",
    type: "oil",
    signal: "Thrives when partnering with God to understand rather than relying on analysis alone.",
    weight: 2,
    counterExemplar: "Turns to astrology or self-made systems to read the times when disconnected from the source.",
  },
  {
    id: "issachar-shadow-1",
    tribeSlug: "issachar",
    type: "shadow",
    signal: "Over-analyzes and needs all risk eliminated before they will act.",
    weight: 2,
  },
  {
    id: "issachar-fallLine-1",
    tribeSlug: "issachar",
    type: "fallLine",
    signal: "Sees clearly but stays silent from fear of being wrong — cowardice, slow to respond.",
    weight: 3,
  },
];

const zebulun: Marker[] = [
  {
    id: "zebulun-strength-1",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Generates resources and prosperity that create influence.",
    weight: 2,
  },
  {
    id: "zebulun-strength-2",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Mobilizes resources and draws people in; builds enterprise and expansion.",
    weight: 1,
  },
  {
    id: "zebulun-strength-3",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Creates momentum and growth around them.",
    weight: 1,
  },
  {
    id: "zebulun-oil-1",
    tribeSlug: "zebulun",
    type: "oil",
    signal: "Comes alive giving resources away and asking what to multiply rather than what to hoard.",
    weight: 2,
    counterExemplar: "Measures success by what is kept and accumulated.",
  },
  {
    id: "zebulun-shadow-1",
    tribeSlug: "zebulun",
    type: "shadow",
    signal: "Tempted to half-obedience — stops short and tolerates the compromise inside the very area of their gift.",
    weight: 2,
  },
  {
    id: "zebulun-fallLine-1",
    tribeSlug: "zebulun",
    type: "fallLine",
    signal: "Reduces everything to financial return — monetizes what was never meant to carry a price.",
    weight: 3,
  },
];

const joseph: Marker[] = [
  {
    id: "joseph-strength-1",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Maintains integrity and fortitude under hostile, predatory conditions.",
    weight: 2,
  },
  {
    id: "joseph-strength-2",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Administrates and controls at large scale; built to execute behind the scenes.",
    weight: 1,
  },
  {
    id: "joseph-strength-3",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Thrives as the trusted second supporting someone else's mission and calling.",
    weight: 1,
  },
  {
    id: "joseph-oil-1",
    tribeSlug: "joseph",
    type: "oil",
    signal: "Stays warm when witnessed and affirmed as a person, not just used for his output.",
    weight: 2,
    counterExemplar: "Only seeks praise for outcomes, not to be seen in the labor.",
  },
  {
    id: "joseph-shadow-1",
    tribeSlug: "joseph",
    type: "shadow",
    signal: "Misuses past pain — turns cold, cynical, and holds resentment.",
    weight: 2,
  },
  {
    id: "joseph-fallLine-1",
    tribeSlug: "joseph",
    type: "fallLine",
    signal: "Cuts off from the source and isolates — resilience curdles into detachment and powerlessness.",
    weight: 3,
  },
];

const benjamin: Marker[] = [
  {
    id: "benjamin-strength-1",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Fierce and intense in hard places — comes alive where others will not go.",
    weight: 2,
  },
  {
    id: "benjamin-strength-2",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Protective of their people; treats every threat as something winnable.",
    weight: 1,
  },
  {
    id: "benjamin-strength-3",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Reads culture shrewdly; cunning and tactically sharp.",
    weight: 1,
  },
  {
    id: "benjamin-oil-1",
    tribeSlug: "benjamin",
    type: "oil",
    signal: "Channels intensity well when given a clear, God-given enemy and mission to fight for.",
    weight: 2,
    counterExemplar: "Manufactures conflict and keeps fighting when no real target exists.",
  },
  {
    id: "benjamin-shadow-1",
    tribeSlug: "benjamin",
    type: "shadow",
    signal: "Avoids appearing weak at all costs; becomes intimidating, impulsive, and addicted to conflict.",
    weight: 2,
  },
  {
    id: "benjamin-fallLine-1",
    tribeSlug: "benjamin",
    type: "fallLine",
    signal: "Turns warfare on their own people — devours and betrays what they were meant to protect.",
    weight: 3,
  },
];

const dan: Marker[] = [
  {
    id: "dan-strength-1",
    tribeSlug: "dan",
    type: "strength",
    signal: "Discerns and reads threats before others see them — the watchman / sentinel.",
    weight: 2,
  },
  {
    id: "dan-strength-2",
    tribeSlug: "dan",
    type: "strength",
    signal: "Strategically vigilant with strong positional awareness.",
    weight: 1,
  },
  {
    id: "dan-strength-3",
    tribeSlug: "dan",
    type: "strength",
    signal: "Predatory intelligence and quick reflexes in detecting deception.",
    weight: 1,
  },
  {
    id: "dan-oil-1",
    tribeSlug: "dan",
    type: "oil",
    signal: "Settled when trusting God's faithfulness rather than only their own vigilance.",
    weight: 2,
    counterExemplar: "Relies on personal control because they cannot bring themselves to trust.",
  },
  {
    id: "dan-shadow-1",
    tribeSlug: "dan",
    type: "shadow",
    signal: "Discernment calcifies into cynicism and suspicion; fixated on the fear of being deceived.",
    weight: 2,
  },
  {
    id: "dan-fallLine-1",
    tribeSlug: "dan",
    type: "fallLine",
    signal: "Corrupted judgment turns to idolatry and false substitutes when the real thing feels out of reach.",
    weight: 3,
  },
];

const naphtali: Marker[] = [
  {
    id: "naphtali-strength-1",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Brings freedom and healing to others, especially through transitions.",
    weight: 2,
  },
  {
    id: "naphtali-strength-2",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Encourages and expresses beauty that lifts people.",
    weight: 1,
  },
  {
    id: "naphtali-strength-3",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Turns their own surrendered pain into the very thing that heals others.",
    weight: 1,
  },
  {
    id: "naphtali-oil-1",
    tribeSlug: "naphtali",
    type: "oil",
    signal: "Flourishes when their movement toward freedom is commissioned as ministry for others.",
    weight: 2,
    counterExemplar: "Uses their freedom and speed to flee rather than to carry others out.",
  },
  {
    id: "naphtali-shadow-1",
    tribeSlug: "naphtali",
    type: "shadow",
    signal: "Avoids pain and fears rejection — the very things that qualify them to heal.",
    weight: 2,
  },
  {
    id: "naphtali-fallLine-1",
    tribeSlug: "naphtali",
    type: "fallLine",
    signal: "Gift of expression turns inward into escapism and self-focus instead of healing others.",
    weight: 3,
  },
];

const asher: Marker[] = [
  {
    id: "asher-strength-1",
    tribeSlug: "asher",
    type: "strength",
    signal: "Creates environments where people feel fed, welcomed, and enriched.",
    weight: 2,
  },
  {
    id: "asher-strength-2",
    tribeSlug: "asher",
    type: "strength",
    signal: "Generous and hospitable; nourishes those around them.",
    weight: 1,
  },
  {
    id: "asher-strength-3",
    tribeSlug: "asher",
    type: "strength",
    signal: "Naturally cultivates warm, enriching atmospheres.",
    weight: 1,
  },
  {
    id: "asher-oil-1",
    tribeSlug: "asher",
    type: "oil",
    signal: "Comes alive creating an atmosphere that nourishes others — where they find purpose and energy.",
    weight: 2,
    counterExemplar: "Withdraws into private comfort instead of building something for others.",
  },
  {
    id: "asher-shadow-1",
    tribeSlug: "asher",
    type: "shadow",
    signal: "Addicted to comfort; passive and people-pleasing to feel better about themselves.",
    weight: 2,
  },
  {
    id: "asher-fallLine-1",
    tribeSlug: "asher",
    type: "fallLine",
    signal: "Falls into scarcity and retreat — avoids friction so completely the peacemaker becomes an enabler.",
    weight: 3,
  },
];

const gad: Marker[] = [
  {
    id: "gad-strength-1",
    tribeSlug: "gad",
    type: "strength",
    signal: "Endures on the frontline; rebuilds under pressure and does not quit.",
    weight: 2,
  },
  {
    id: "gad-strength-2",
    tribeSlug: "gad",
    type: "strength",
    signal: "Drawn to the hard, forgotten places no one else will go.",
    weight: 1,
  },
  {
    id: "gad-strength-3",
    tribeSlug: "gad",
    type: "strength",
    signal: "Survives and presses through overwhelming conditions.",
    weight: 1,
  },
  {
    id: "gad-oil-1",
    tribeSlug: "gad",
    type: "oil",
    signal: "Sustained by rest — the thing they resist most but most need to keep functioning.",
    weight: 2,
    counterExemplar: "Treats rest as betrayal and refuses to stop until they break.",
  },
  {
    id: "gad-shadow-1",
    tribeSlug: "gad",
    type: "shadow",
    signal: "Fears collapse and overwhelm despite being built to endure everything.",
    weight: 2,
  },
  {
    id: "gad-fallLine-1",
    tribeSlug: "gad",
    type: "fallLine",
    signal: "Never stops until they break — rest feels like letting people down, ending in burnout and collapse.",
    weight: 3,
  },
];

const reuben: Marker[] = [
  {
    id: "reuben-strength-1",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Carries unusually high potential and leadership capacity — a firstborn anointing.",
    weight: 2,
  },
  {
    id: "reuben-strength-2",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Wired to carry the blessing and lead with more capacity than almost any other tribe.",
    weight: 1,
  },
  {
    id: "reuben-strength-3",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Strong drive and zeal to take initiative.",
    weight: 1,
  },
  {
    id: "reuben-oil-1",
    tribeSlug: "reuben",
    type: "oil",
    signal: "Grows when constraint is given by someone they respect, framed as initiation into greater authority.",
    weight: 2,
    counterExemplar: "Breaks down when constraint is imposed as punishment rather than initiation.",
  },
  {
    id: "reuben-shadow-1",
    tribeSlug: "reuben",
    type: "shadow",
    signal: "Unstable and impulsive; over-zealous with no container, gives away authority through lack of restraint.",
    weight: 2,
  },
  {
    id: "reuben-fallLine-1",
    tribeSlug: "reuben",
    type: "fallLine",
    signal: "Forfeits the blessing through the one appetite they could not control — sexual immorality.",
    weight: 3,
  },
];

const simeon: Marker[] = [
  {
    id: "simeon-strength-1",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Burning zeal for holiness and passionate conviction.",
    weight: 2,
  },
  {
    id: "simeon-strength-2",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Action-oriented commitment — moves decisively on what matters.",
    weight: 1,
  },
  {
    id: "simeon-strength-3",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Deep attunement to God's voice and to what matters ('Hearing').",
    weight: 1,
  },
  {
    id: "simeon-oil-1",
    tribeSlug: "simeon",
    type: "oil",
    signal: "Conviction matures when infused with mercy and compassion — learns the heart behind the law.",
    weight: 2,
    counterExemplar: "Applies the rule with zero mercy, understanding the law but not its intent.",
  },
  {
    id: "simeon-shadow-1",
    tribeSlug: "simeon",
    type: "shadow",
    signal: "Understands the rules but not their intent; conviction with no mercy, wisdom, or proper authority.",
    weight: 2,
  },
  {
    id: "simeon-fallLine-1",
    tribeSlug: "simeon",
    type: "fallLine",
    signal: "Advocates cruelty without balance — even premeditated deception to enable harm.",
    weight: 3,
  },
];

/** The catalog, keyed by tribe `slug`. */
export const markerCatalog: Record<string, Marker[]> = {
  judah,
  levi,
  issachar,
  zebulun,
  joseph,
  benjamin,
  dan,
  naphtali,
  asher,
  gad,
  reuben,
  simeon,
};

/** Flat view of every Marker across all tribes. */
export const allMarkers: Marker[] = Object.values(markerCatalog).flat();

/**
 * Validate a set of Markers against the real tribe slugs. Pure and
 * parameterized so tests can drive it with synthetic data; called at module
 * load below so the real catalog can never silently drift.
 *
 * Throws on: an unknown / invalid type, an out-of-bounds weight, an empty
 * signal, a slug that is not a real tribe, a duplicate id, a tribe with no
 * coverage, or coverage that is uneven beyond {@link COVERAGE_TOLERANCE}.
 */
export function validateMarkerCatalog(markers: Marker[], validSlugs: string[]): void {
  const slugSet = new Set(validSlugs);

  for (const m of markers) {
    if (!MARKER_TYPES.includes(m.type)) {
      throw new Error(`Marker "${m.id}" has invalid type "${m.type}".`);
    }
    if (typeof m.weight !== "number" || m.weight < MIN_WEIGHT || m.weight > MAX_WEIGHT) {
      throw new Error(
        `Marker "${m.id}" has out-of-bounds weight ${m.weight} (expected ${MIN_WEIGHT}–${MAX_WEIGHT}).`,
      );
    }
    if (!m.signal || m.signal.trim().length === 0) {
      throw new Error(`Marker "${m.id}" has an empty signal.`);
    }
    if (!slugSet.has(m.tribeSlug)) {
      throw new Error(`Marker "${m.id}" references unknown tribe slug "${m.tribeSlug}".`);
    }
  }

  const seenIds = new Set<string>();
  for (const m of markers) {
    if (seenIds.has(m.id)) {
      throw new Error(`Duplicate marker id "${m.id}".`);
    }
    seenIds.add(m.id);
  }

  const counts = new Map<string, number>();
  for (const slug of validSlugs) counts.set(slug, 0);
  for (const m of markers) counts.set(m.tribeSlug, (counts.get(m.tribeSlug) ?? 0) + 1);

  const uncovered = [...counts.entries()].filter(([, n]) => n === 0).map(([slug]) => slug);
  if (uncovered.length > 0) {
    throw new Error(`Marker coverage incomplete: no markers for tribe(s) ${uncovered.join(", ")}.`);
  }

  const values = [...counts.values()];
  const spread = Math.max(...values) - Math.min(...values);
  if (spread > COVERAGE_TOLERANCE) {
    throw new Error(
      `Uneven marker coverage: spread of ${spread} exceeds tolerance ${COVERAGE_TOLERANCE}.`,
    );
  }
}

// Fail loudly at import time if the catalog has drifted from the tribe data.
validateMarkerCatalog(
  allMarkers,
  tribes.map((t) => t.slug),
);
