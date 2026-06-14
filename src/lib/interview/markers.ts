import "server-only";

import { tribes } from "@/lib/tribes";

/**
 * The Marker Catalog — the rubric the Interview scores against (ADR-0003,
 * ADR-0010). Every strength delta the agent assigns must cite a Marker `id`
 * from this catalog; the agent may not invent ad-hoc rationale.
 *
 * This module is **server-only** (`import "server-only"` above): the catalog is
 * a scoring concern behind a trust boundary and must never reach a client
 * bundle. It is kept separate from `tribes.ts`, which is the client-facing
 * render source of truth.
 *
 * Markers are **hand-distilled** from each tribe's `strengths` / `oil` /
 * `shadow` / `fallLine` prose, with **even coverage** across all 12 tribes so
 * no tribe is harder to surface (ADR-0010). Do not "normalize" the catalog to
 * the uneven proportions of the 73-word list — even coverage is deliberate.
 */

/** Which profile field a Marker is distilled from (CONTEXT.md "Marker Type"). */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

export const MARKER_TYPES: readonly MarkerType[] = [
  "strength",
  "oil",
  "shadow",
  "fallLine",
];

/**
 * A concrete, observable signal distilled from a tribe's profile that an answer
 * can be mapped to, carrying a bounded weight toward that tribe's strength.
 */
export interface Marker {
  /** Stable, citable id used in the score trace, e.g. `judah-strength-1`. */
  id: string;
  /** The tribe this Marker scores toward; validated against `tribes.ts`. */
  tribeSlug: string;
  /** Which profile field this Marker is distilled from. */
  type: MarkerType;
  /** The observable thing in plain language. */
  signal: string;
  /** Bounded weight toward strength; shadow/fall-line may weight higher. */
  weight: number;
  /** First-person resonance with the theme (anchors the agent toward a hit). */
  exemplar?: string;
  /** Conceptual/third-person description that should NOT score (curbs false positives). */
  counterExemplar?: string;
}

/** Inclusive bounds on a Marker's `weight`. */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 3;

/** Standard weights by type — shadow and fall-line are weighted higher as the
 * most bias-resistant signals (people do not fake their weaknesses). */
const W = { strength: 2, oil: 2, shadow: 3, fallLine: 3 } as const;

/**
 * Maximum allowed spread (max count − min count) between the most- and
 * least-covered tribe. 0 would demand perfectly equal counts; a small tolerance
 * leaves authoring headroom without letting any tribe become hard to surface.
 */
export const EVEN_COVERAGE_TOLERANCE = 1;

export const markerCatalog: Marker[] = [
  // ── Judah · The Lion — Honor · Courage · Authority ────────────────────────
  {
    id: "judah-strength-1",
    tribeSlug: "judah",
    type: "strength",
    signal:
      "Steps to the front and absorbs the burden for a group rather than observing — sacrificial frontline leadership.",
    weight: W.strength,
  },
  {
    id: "judah-strength-2",
    tribeSlug: "judah",
    type: "strength",
    signal:
      "Carries natural authority and organizes people toward a public, forward-facing mission.",
    weight: W.strength,
  },
  {
    id: "judah-oil-1",
    tribeSlug: "judah",
    type: "oil",
    signal:
      "Comes alive when responsibility and weight are piled on — wants the ball in the fourth quarter.",
    weight: W.oil,
    exemplar: "Asks for the hardest assignment because the pressure is where they feel most themselves.",
    counterExemplar: "Wants the spotlight of a big role for the recognition, not the weight of it.",
  },
  {
    id: "judah-shadow-1",
    tribeSlug: "judah",
    type: "shadow",
    signal:
      "Confuses visibility with significance and presence with impact; needs to be seen to feel valuable.",
    weight: W.shadow,
  },
  {
    id: "judah-fallLine-1",
    tribeSlug: "judah",
    type: "fallLine",
    signal:
      "Drawn to abuse position or consume what belongs to others when leading without accountability.",
    weight: W.fallLine,
    exemplar: "Names a personal pull to bend the rules once they hold power.",
    counterExemplar: "Merely disapproves of corrupt leaders in the abstract.",
  },
  {
    id: "judah-fallLine-2",
    tribeSlug: "judah",
    type: "fallLine",
    signal:
      "Appetite for influence has an underside of sexual immorality / unchecked appetite.",
    weight: W.fallLine,
  },

  // ── Levi · The Priest — Worship · Teaching · Consecration ─────────────────
  {
    id: "levi-strength-1",
    tribeSlug: "levi",
    type: "strength",
    signal:
      "Instinctively guards what is holy and reacts strongly when the sacred is treated casually.",
    weight: W.strength,
  },
  {
    id: "levi-strength-2",
    tribeSlug: "levi",
    type: "strength",
    signal:
      "Drawn to teach and consecrate — translating what pleases God to others; at home being set apart.",
    weight: W.strength,
  },
  {
    id: "levi-oil-1",
    tribeSlug: "levi",
    type: "oil",
    signal:
      "Comes alive through direct, unmediated encounter with God rather than managing the protocols around it.",
    weight: W.oil,
    exemplar: "Hungers to be in the presence itself, not to run the room.",
    counterExemplar: "Finds satisfaction primarily in keeping the system and rules correct.",
  },
  {
    id: "levi-shadow-1",
    tribeSlug: "levi",
    type: "shadow",
    signal:
      "Slides into legalism and spiritual elitism — severity and rule-keeping standing in for relationship.",
    weight: W.shadow,
  },
  {
    id: "levi-fallLine-1",
    tribeSlug: "levi",
    type: "fallLine",
    signal:
      "Gatekeeps access to God — puts a price or condition on godliness that God never charged.",
    weight: W.fallLine,
    exemplar: "Catches themselves making others earn what should be freely given.",
    counterExemplar: "Can describe gatekeeping religion as a problem 'other churches' have.",
  },
  {
    id: "levi-fallLine-2",
    tribeSlug: "levi",
    type: "fallLine",
    signal:
      "Uses scripture or truth as a weapon and keeps the form of religion after the relationship is gone.",
    weight: W.fallLine,
  },

  // ── Issachar · The Sage — Discernment · Timing · Wisdom ───────────────────
  {
    id: "issachar-strength-1",
    tribeSlug: "issachar",
    type: "strength",
    signal:
      "Reads timing and patterns others miss; obsessed with understanding the moment.",
    weight: W.strength,
  },
  {
    id: "issachar-strength-2",
    tribeSlug: "issachar",
    type: "strength",
    signal:
      "Studies history and data, then translates it into clear instruction on what to do.",
    weight: W.strength,
  },
  {
    id: "issachar-oil-1",
    tribeSlug: "issachar",
    type: "oil",
    signal:
      "Operates at full capacity when partnering with God to interpret, not relying on analysis alone.",
    weight: W.oil,
    exemplar: "Takes a read straight to God before trusting their own pattern-matching.",
    counterExemplar: "Treats prayer as one more data source to optimize a decision.",
  },
  {
    id: "issachar-shadow-1",
    tribeSlug: "issachar",
    type: "shadow",
    signal:
      "Over-analyzes and demands risk be eliminated before they will move.",
    weight: W.shadow,
  },
  {
    id: "issachar-fallLine-1",
    tribeSlug: "issachar",
    type: "fallLine",
    signal:
      "Goes around God to other sources — trends, astrology, analytics — to read the times when disconnected.",
    weight: W.fallLine,
    exemplar: "Admits reaching for horoscopes or systems when their source feels distant.",
    counterExemplar: "Critiques 'New Age' thinking without any personal pull toward it.",
  },
  {
    id: "issachar-fallLine-2",
    tribeSlug: "issachar",
    type: "fallLine",
    signal:
      "Sees and knows what to do but stays silent out of fear of misdiagnosing the moment — cowardice as paralysis.",
    weight: W.fallLine,
  },

  // ── Zebulun · The Merchant — Enterprise · Abundance · Influence ───────────
  {
    id: "zebulun-strength-1",
    tribeSlug: "zebulun",
    type: "strength",
    signal:
      "Generates abundance and turns resources into influence and expansion.",
    weight: W.strength,
  },
  {
    id: "zebulun-strength-2",
    tribeSlug: "zebulun",
    type: "strength",
    signal:
      "Mobilizes resources and draws people into a venture; enterprising by instinct.",
    weight: W.strength,
  },
  {
    id: "zebulun-oil-1",
    tribeSlug: "zebulun",
    type: "oil",
    signal:
      "Thrives when giving and multiplying rather than hoarding; asks what to multiply, kept moving by momentum.",
    weight: W.oil,
    exemplar: "Energized by giving resources away to expand a mission.",
    counterExemplar: "Gives only when there is a clear return on the gift.",
  },
  {
    id: "zebulun-shadow-1",
    tribeSlug: "zebulun",
    type: "shadow",
    signal:
      "Half-obedience — stops short of finishing, especially inside the very area of their gifting.",
    weight: W.shadow,
  },
  {
    id: "zebulun-fallLine-1",
    tribeSlug: "zebulun",
    type: "fallLine",
    signal:
      "Greed — measures everything by financial return, including things never meant to have a price.",
    weight: W.fallLine,
    exemplar: "Notices they instinctively price-tag relationships or calling.",
    counterExemplar: "Can name greed as a cultural problem without owning the lens.",
  },
  {
    id: "zebulun-fallLine-2",
    tribeSlug: "zebulun",
    type: "fallLine",
    signal:
      "Monetizes what should not be monetized; reduces people and relationships to transactions.",
    weight: W.fallLine,
  },

  // ── Joseph · The Bull — Resilience · Order · Fortitude ────────────────────
  {
    id: "joseph-strength-1",
    tribeSlug: "joseph",
    type: "strength",
    signal:
      "Holds fortitude and keeps functioning in hostile, predatory environments.",
    weight: W.strength,
  },
  {
    id: "joseph-strength-2",
    tribeSlug: "joseph",
    type: "strength",
    signal:
      "Runs order and administration at scale, content as the instrumental second-in-command behind another's mission.",
    weight: W.strength,
  },
  {
    id: "joseph-oil-1",
    tribeSlug: "joseph",
    type: "oil",
    signal:
      "Stays warm when witnessed and valued as a person in the labor, not just for outcomes or utility.",
    weight: W.oil,
    exemplar: "Needs someone to see their integrity in the pit, not praise the results.",
    counterExemplar: "Wants recognition specifically for what they produced.",
  },
  {
    id: "joseph-shadow-1",
    tribeSlug: "joseph",
    type: "shadow",
    signal:
      "Misuses pain — turns cold, bitter, and cynical, and holds resentment.",
    weight: W.shadow,
  },
  {
    id: "joseph-fallLine-1",
    tribeSlug: "joseph",
    type: "fallLine",
    signal:
      "Detaches and goes cold, cutting off connection rather than staying present in the hurt.",
    weight: W.fallLine,
    exemplar: "Recognizes their own move to shut down and harden when wounded.",
    counterExemplar: "Observes that other people get cold and bitter under pressure.",
  },
  {
    id: "joseph-fallLine-2",
    tribeSlug: "joseph",
    type: "fallLine",
    signal:
      "Disconnects from God / source so the resilience that was strength curdles into isolation and powerlessness.",
    weight: W.fallLine,
  },

  // ── Benjamin · The Wolf — Ferocity · Loyalty · Cunning ────────────────────
  {
    id: "benjamin-strength-1",
    tribeSlug: "benjamin",
    type: "strength",
    signal:
      "Fierce and intense in hard places — comes alive when dropped into difficulty; treats everything as winnable.",
    weight: W.strength,
  },
  {
    id: "benjamin-strength-2",
    tribeSlug: "benjamin",
    type: "strength",
    signal:
      "Reads culture and danger quickly; cunning and fiercely protective of their people.",
    weight: W.strength,
  },
  {
    id: "benjamin-oil-1",
    tribeSlug: "benjamin",
    type: "oil",
    signal:
      "Operates best with a clear, God-given enemy and mission to fight for; give them a hill to take.",
    weight: W.oil,
    exemplar: "Settles and focuses once a worthy, sanctioned target is named.",
    counterExemplar: "Manufactures enemies so there is always something to fight.",
  },
  {
    id: "benjamin-shadow-1",
    tribeSlug: "benjamin",
    type: "shadow",
    signal:
      "Avoids appearing weak, dumb, or scared at all costs; becomes intimidating and impulsive.",
    weight: W.shadow,
  },
  {
    id: "benjamin-fallLine-1",
    tribeSlug: "benjamin",
    type: "fallLine",
    signal:
      "Can't turn the warfare off — keeps fighting battles never commissioned; addicted to war and chaos.",
    weight: W.fallLine,
    exemplar: "Admits to picking fights when no real enemy is present.",
    counterExemplar: "Describes other people as needlessly combative.",
  },
  {
    id: "benjamin-fallLine-2",
    tribeSlug: "benjamin",
    type: "fallLine",
    signal:
      "Devours what they were meant to protect — attaches to people, then turns on them when threatened.",
    weight: W.fallLine,
  },

  // ── Dan · The Serpent — Vigilance · Strategy · Discernment ────────────────
  {
    id: "dan-strength-1",
    tribeSlug: "dan",
    type: "strength",
    signal:
      "The watchman — reads threats and patterns before others see them; strategically vigilant.",
    weight: W.strength,
  },
  {
    id: "dan-strength-2",
    tribeSlug: "dan",
    type: "strength",
    signal:
      "Quick, predatory intelligence with sharp positional awareness; sees what no one else sees.",
    weight: W.strength,
  },
  {
    id: "dan-oil-1",
    tribeSlug: "dan",
    type: "oil",
    signal:
      "Becomes a wise counselor and protector when trusting God's faithfulness instead of his own vigilance.",
    weight: W.oil,
    exemplar: "Can let go of control because they trust God is already watching.",
    counterExemplar: "Says they trust God but still must verify and guard everything themselves.",
  },
  {
    id: "dan-shadow-1",
    tribeSlug: "dan",
    type: "shadow",
    signal:
      "Fear of being deceived hardens discernment into cynicism and control, drawing other cynics in.",
    weight: W.shadow,
  },
  {
    id: "dan-fallLine-1",
    tribeSlug: "dan",
    type: "fallLine",
    signal:
      "Builds a counterfeit / drifts to idolatry when the real thing feels out of reach.",
    weight: W.fallLine,
    exemplar: "Recognizes setting up their own substitute when God felt distant.",
    counterExemplar: "Discusses idolatry as a historical or doctrinal category only.",
  },
  {
    id: "dan-fallLine-2",
    tribeSlug: "dan",
    type: "fallLine",
    signal:
      "Trusts his own watching over God and catastrophically misreads the decisive moment.",
    weight: W.fallLine,
  },

  // ── Naphtali · The Deer — Freedom · Beauty · Healing ──────────────────────
  {
    id: "naphtali-strength-1",
    tribeSlug: "naphtali",
    type: "strength",
    signal:
      "Brings freedom, beauty, and encouragement to others; gifted in expression.",
    weight: W.strength,
  },
  {
    id: "naphtali-strength-2",
    tribeSlug: "naphtali",
    type: "strength",
    signal:
      "Oversees transitions and heals — turns their own surrendered pain into others' healing.",
    weight: W.strength,
  },
  {
    id: "naphtali-oil-1",
    tribeSlug: "naphtali",
    type: "oil",
    signal:
      "Thrives when freedom is commissioned as outward ministry for others, not personal flight.",
    weight: W.oil,
    exemplar: "Energized when their movement toward freedom is framed as carrying others out.",
    counterExemplar: "Seeks freedom mainly as escape for themselves.",
  },
  {
    id: "naphtali-shadow-1",
    tribeSlug: "naphtali",
    type: "shadow",
    signal:
      "Avoids pain and heaviness and fears captivity — fleeing the very thing that qualifies them to heal.",
    weight: W.shadow,
  },
  {
    id: "naphtali-fallLine-1",
    tribeSlug: "naphtali",
    type: "fallLine",
    signal:
      "Escapism — runs from difficulty rather than toward the people they were sent to heal.",
    weight: W.fallLine,
    exemplar: "Notices their reflex to bolt when things get heavy.",
    counterExemplar: "Comments that avoidance is a common human coping pattern.",
  },
  {
    id: "naphtali-fallLine-2",
    tribeSlug: "naphtali",
    type: "fallLine",
    signal:
      "Gift of beauty and expression turns inward and becomes about them rather than the people they serve.",
    weight: W.fallLine,
  },

  // ── Asher · The Olive Tree — Hospitality · Nourishment · Generosity ───────
  {
    id: "asher-strength-1",
    tribeSlug: "asher",
    type: "strength",
    signal:
      "Creates environments where people are fed, welcomed, and enriched; generous by instinct.",
    weight: W.strength,
  },
  {
    id: "asher-strength-2",
    tribeSlug: "asher",
    type: "strength",
    signal:
      "Nourishes and hosts — hospitality is a native, default posture.",
    weight: W.strength,
  },
  {
    id: "asher-oil-1",
    tribeSlug: "asher",
    type: "oil",
    signal:
      "Comes alive creating an enriching atmosphere that nourishes others — finds purpose and energy there.",
    weight: W.oil,
    exemplar: "Lights up when building a space where others flourish.",
    counterExemplar: "Hosts mainly to be liked or to feel good about themselves.",
  },
  {
    id: "asher-shadow-1",
    tribeSlug: "asher",
    type: "shadow",
    signal:
      "Addiction to comfort and over-indulgence; people-pleasing that is really about feeling better about themselves.",
    weight: W.shadow,
  },
  {
    id: "asher-fallLine-1",
    tribeSlug: "asher",
    type: "fallLine",
    signal:
      "Scarcity mindset and retreat — becomes insecure and withholds when things are lacking.",
    weight: W.fallLine,
    exemplar: "Recognizes pulling back and hoarding when resources feel short.",
    counterExemplar: "Describes scarcity thinking as an economic concept.",
  },
  {
    id: "asher-fallLine-2",
    tribeSlug: "asher",
    type: "fallLine",
    signal:
      "Avoids friction at all costs; the peacemaker becomes the enabler of dysfunction.",
    weight: W.fallLine,
  },

  // ── Gad · The Raider — Grit · Endurance · Resistance ──────────────────────
  {
    id: "gad-strength-1",
    tribeSlug: "gad",
    type: "strength",
    signal:
      "Frontline grit — rebuilds under pressure and refuses to quit.",
    weight: W.strength,
  },
  {
    id: "gad-strength-2",
    tribeSlug: "gad",
    type: "strength",
    signal:
      "Drawn to the hard, forgotten ground no one else will take; built to endure and survive.",
    weight: W.strength,
  },
  {
    id: "gad-oil-1",
    tribeSlug: "gad",
    type: "oil",
    signal:
      "Rest is the oil that keeps them functioning — and the thing they resist most.",
    weight: W.oil,
    exemplar: "Learning to receive rest as survival rather than weakness.",
    counterExemplar: "Treats rest as betrayal and pushes through anyway.",
  },
  {
    id: "gad-shadow-1",
    tribeSlug: "gad",
    type: "shadow",
    signal:
      "Fear of collapse and of being overwhelmed — ironic for the one built to endure everything.",
    weight: W.shadow,
  },
  {
    id: "gad-fallLine-1",
    tribeSlug: "gad",
    type: "fallLine",
    signal:
      "Burnout — never stops because rest feels like letting people down, until they break.",
    weight: W.fallLine,
    exemplar: "Names their own pattern of running until they crash.",
    counterExemplar: "Observes that burnout is common in driven people.",
  },
  {
    id: "gad-fallLine-2",
    tribeSlug: "gad",
    type: "fallLine",
    signal:
      "Doesn't just slow down but collapses — when the grit finally fails it fails all at once.",
    weight: W.fallLine,
  },

  // ── Reuben · The Firstborn — Potential · Leadership · Capacity ────────────
  {
    id: "reuben-strength-1",
    tribeSlug: "reuben",
    type: "strength",
    signal:
      "Carries high potential and capacity — wired to lead and to carry a blessing.",
    weight: W.strength,
  },
  {
    id: "reuben-strength-2",
    tribeSlug: "reuben",
    type: "strength",
    signal:
      "Firstborn anointing — more raw leadership capacity than almost any other tribe.",
    weight: W.strength,
  },
  {
    id: "reuben-oil-1",
    tribeSlug: "reuben",
    type: "oil",
    signal:
      "Grows under mentored constraint framed as initiation into greater authority, not punishment.",
    weight: W.oil,
    exemplar: "Accepts limits from a respected mentor as a path to deeper authority.",
    counterExemplar: "Experiences every limit as loss and bristles against it.",
  },
  {
    id: "reuben-shadow-1",
    tribeSlug: "reuben",
    type: "shadow",
    signal:
      "Unstable and impulsive; gives away authority through lack of restraint, overzealous with no container.",
    weight: W.shadow,
  },
  {
    id: "reuben-fallLine-1",
    tribeSlug: "reuben",
    type: "fallLine",
    signal:
      "Forfeits the blessing through sexual immorality / the appetite they cannot control.",
    weight: W.fallLine,
    exemplar: "Owns a specific appetite that has cost them what they were given.",
    counterExemplar: "Speaks of others squandering their potential, not themselves.",
  },
  {
    id: "reuben-fallLine-2",
    tribeSlug: "reuben",
    type: "fallLine",
    signal:
      "Arrives too late and lacks the decisive container to hold what they are given.",
    weight: W.fallLine,
  },

  // ── Simeon · The Blade — Conviction · Zeal · Justice ──────────────────────
  {
    id: "simeon-strength-1",
    tribeSlug: "simeon",
    type: "strength",
    signal:
      "Zeal for holiness and passionate, action-oriented conviction.",
    weight: W.strength,
  },
  {
    id: "simeon-strength-2",
    tribeSlug: "simeon",
    type: "strength",
    signal:
      "Deep attunement to God's voice and to what matters — the buried gift of 'hearing'.",
    weight: W.strength,
  },
  {
    id: "simeon-oil-1",
    tribeSlug: "simeon",
    type: "oil",
    signal:
      "Conviction infused with mercy — has learned the heart and intent behind the law.",
    weight: W.oil,
    exemplar: "Holds a hard truth and delivers it with compassion.",
    counterExemplar: "Believes the answer to failure is simply more rules and severity.",
  },
  {
    id: "simeon-shadow-1",
    tribeSlug: "simeon",
    type: "shadow",
    signal:
      "Conviction with zero mercy — knows God's rules but not His intent; without structure the blade has no direction.",
    weight: W.shadow,
  },
  {
    id: "simeon-fallLine-1",
    tribeSlug: "simeon",
    type: "fallLine",
    signal:
      "Advocates cruelty with no balance — zeal untethered from wisdom or proper authority.",
    weight: W.fallLine,
    exemplar: "Recognizes their own capacity for merciless overreach in the name of right.",
    counterExemplar: "Condemns cruelty in others without seeing the pull in themselves.",
  },
  {
    id: "simeon-fallLine-2",
    tribeSlug: "simeon",
    type: "fallLine",
    signal:
      "Uses deception to enable harm — premeditated scheming carried out in the name of justice.",
    weight: W.fallLine,
  },
];

export class MarkerCatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkerCatalogValidationError";
  }
}

/** Count Markers per tribe slug, including the 0 for any tribe with none. */
function coverageBySlug(catalog: readonly Marker[]): Map<string, number> {
  const counts = new Map<string, number>(tribes.map((t) => [t.slug, 0]));
  for (const m of catalog) {
    counts.set(m.tribeSlug, (counts.get(m.tribeSlug) ?? 0) + 1);
  }
  return counts;
}

/**
 * Validate a Marker Catalog, throwing {@link MarkerCatalogValidationError} on
 * the first failing invariant. Accepts a catalog so it can be exercised against
 * deliberately-bad fixtures in tests; defaults to the real {@link markerCatalog}.
 *
 * Invariants:
 *  1. Marker ids are unique.
 *  2. Every `tribeSlug` resolves to a tribe in `tribes.ts`.
 *  3. Every `type` is a known {@link MarkerType} and `weight` is within bounds.
 *  4. All four Marker types appear for every tribe.
 *  5. Coverage is even — the spread between the most- and least-covered tribe is
 *     within `tolerance`.
 */
export function validateMarkerCatalog(
  catalog: readonly Marker[] = markerCatalog,
  { tolerance = EVEN_COVERAGE_TOLERANCE }: { tolerance?: number } = {},
): void {
  // 1. unique ids
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const m of catalog) {
    if (seen.has(m.id)) duplicates.add(m.id);
    seen.add(m.id);
  }
  if (duplicates.size > 0) {
    throw new MarkerCatalogValidationError(
      `Duplicate marker ids: ${[...duplicates].join(", ")}`,
    );
  }

  // 2. every tribeSlug resolves against tribes.ts
  const validSlugs = new Set(tribes.map((t) => t.slug));
  const orphans = catalog.filter((m) => !validSlugs.has(m.tribeSlug));
  if (orphans.length > 0) {
    const detail = orphans.map((m) => `${m.id} → "${m.tribeSlug}"`).join(", ");
    throw new MarkerCatalogValidationError(
      `Marker(s) reference an unknown tribe slug: ${detail}`,
    );
  }

  // 3. valid type and bounded weight
  for (const m of catalog) {
    if (!MARKER_TYPES.includes(m.type)) {
      throw new MarkerCatalogValidationError(
        `Marker ${m.id} has unknown type "${m.type}"`,
      );
    }
    if (
      !Number.isFinite(m.weight) ||
      m.weight < MIN_WEIGHT ||
      m.weight > MAX_WEIGHT
    ) {
      throw new MarkerCatalogValidationError(
        `Marker ${m.id} weight ${m.weight} is outside [${MIN_WEIGHT}, ${MAX_WEIGHT}]`,
      );
    }
  }

  // 4. all four types present for every tribe
  const typesBySlug = new Map<string, Set<MarkerType>>(
    tribes.map((t) => [t.slug, new Set<MarkerType>()]),
  );
  for (const m of catalog) {
    typesBySlug.get(m.tribeSlug)?.add(m.type);
  }
  for (const [slug, types] of typesBySlug) {
    const missing = MARKER_TYPES.filter((t) => !types.has(t));
    if (missing.length > 0) {
      throw new MarkerCatalogValidationError(
        `Tribe "${slug}" is missing marker type(s): ${missing.join(", ")}`,
      );
    }
  }

  // 5. even coverage across all 12 tribes
  const counts = coverageBySlug(catalog);
  const values = [...counts.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > tolerance) {
    const breakdown = [...counts.entries()]
      .map(([slug, count]) => `${slug}=${count}`)
      .join(", ");
    throw new MarkerCatalogValidationError(
      `Uneven marker coverage (spread ${max - min} > tolerance ${tolerance}): ${breakdown}`,
    );
  }
}
