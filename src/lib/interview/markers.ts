import "server-only";

import { tribes } from "@/lib/tribes";

/**
 * The Marker Catalog — the rubric the Interview scores answers against
 * (CONTEXT.md, ADR-0010). A Marker is a concrete, observable signal distilled
 * by hand from a tribe's prose in `tribes.ts`; every strength delta the agent
 * assigns must cite one, so this is where the instrument's rigor lives.
 *
 * This module is **server-only** (ADR-0009/0010 trust boundary): the catalog is
 * a scoring concern and must never ship to or be mutated by the client. The
 * `import "server-only"` above turns any client import into a build error.
 *
 * Kept deliberately separate from `tribes.ts`, which is the client-facing render
 * source of truth with a strict ordering invariant; the catalog has different
 * churn and a different audience.
 */

/** Which field of a tribe's profile a Marker is distilled from. */
export type MarkerType = "strength" | "oil" | "shadow" | "fallLine";

export interface Marker {
  /** Stable, unique, citable in the score trace. */
  id: string;
  /** The tribe this Marker scores toward — validated against `tribes.ts`. */
  tribeSlug: string;
  type: MarkerType;
  /** The observable thing, in plain language. */
  signal: string;
  /** Bounded contribution toward the tribe's strength. */
  weight: number;
  /** A snippet anchoring what the Marker looks like when present. */
  exemplar?: string;
  /** A snippet anchoring a near-miss that should NOT fire the Marker. */
  counterExemplar?: string;
}

export const MARKER_TYPES = [
  "strength",
  "oil",
  "shadow",
  "fallLine",
] as const satisfies readonly MarkerType[];

/**
 * Coverage is even across all 12 tribes (ADR-0010) — every tribe gets the same
 * number of Markers so none is harder to surface. This deliberately breaks the
 * uneven word-list precedent; do not "normalize" the catalog to it.
 */
export const MARKERS_PER_TRIBE = 6;

/** Allowed spread between the most- and least-covered tribe. 0 = exactly even. */
export const COVERAGE_TOLERANCE = 0;

/** Weight bounds. Shadow/fall-line weigh higher — they are bias-resistant. */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 3;

const WEIGHT_BY_TYPE: Record<MarkerType, number> = {
  strength: 1,
  oil: 2,
  shadow: 2,
  fallLine: 3,
};

export const markerCatalog: readonly Marker[] = [
  // ── Judah · The Lion ──────────────────────────────────────────────────────
  {
    id: "judah-strength-front",
    tribeSlug: "judah",
    type: "strength",
    signal: "Steps to the front and bears the burden of public leadership rather than watching from safety.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Caleb asking for the hardest mountain after 45 years.",
  },
  {
    id: "judah-strength-weight",
    tribeSlug: "judah",
    type: "strength",
    signal: "Wants the decisive role when the stakes are highest and is willing to carry the weight for others.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "David on the frontline, leading the conquest rather than observing it.",
  },
  {
    id: "judah-strength-conquest",
    tribeSlug: "judah",
    type: "strength",
    signal: "Organizes and leads from the front with raw, zealous firepower.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Josiah's radical reform at twenty-six.",
  },
  {
    id: "judah-oil-responsibility",
    tribeSlug: "judah",
    type: "oil",
    signal: "Comes alive when more responsibility and pressure are piled on, not relieved.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Wanting the ball in the fourth quarter.",
  },
  {
    id: "judah-shadow-insignificance",
    tribeSlug: "judah",
    type: "shadow",
    signal: "Confuses visibility and influence with significance, and fears becoming insignificant.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Asa leaning on political alliances instead of God late in life.",
  },
  {
    id: "judah-fall-power",
    tribeSlug: "judah",
    type: "fallLine",
    signal: "Uses position and power to consume what belongs to others.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "David taking Bathsheba and arranging Uriah's death.",
  },

  // ── Levi · The Priest ─────────────────────────────────────────────────────
  {
    id: "levi-strength-guard",
    tribeSlug: "levi",
    type: "strength",
    signal: "Guards what is holy and is ruthless in defense of sacred things.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Phinehas's zeal earning an everlasting covenant of priesthood.",
  },
  {
    id: "levi-strength-worship",
    tribeSlug: "levi",
    type: "strength",
    signal: "Mediates between God and people through worship; what pleases God is their native language.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "John the Baptist preparing the way and refusing to compromise.",
  },
  {
    id: "levi-strength-teach",
    tribeSlug: "levi",
    type: "strength",
    signal: "Teaches and restores understanding; consecrated and set apart by design.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Ezra restoring covenant understanding after the exile.",
  },
  {
    id: "levi-oil-access",
    tribeSlug: "levi",
    type: "oil",
    signal: "Thrives on direct, unmediated encounter with God rather than managing the protocols around it.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Drawing near to God with a sincere heart (Hebrews 10).",
  },
  {
    id: "levi-shadow-legalism",
    tribeSlug: "levi",
    type: "shadow",
    signal: "Slides into legalism and spiritual elitism, guarding access to God instead of having it.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Aaron caving to build the golden calf when the crowd got loud.",
  },
  {
    id: "levi-fall-gatekeep",
    tribeSlug: "levi",
    type: "fallLine",
    signal: "Wields Scripture as a weapon and gatekeeps access to God — religion without relationship.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "The Pharisees keeping the position after losing the presence.",
  },

  // ── Issachar · The Sage ───────────────────────────────────────────────────
  {
    id: "issachar-strength-timing",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Reads the times and discerns the right moment to act or speak.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "The men of Issachar knowing what Israel should do.",
  },
  {
    id: "issachar-strength-pattern",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Recognizes patterns and studies history to instruct others on what to do.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Deborah telling Barak when to move and why.",
  },
  {
    id: "issachar-strength-source",
    tribeSlug: "issachar",
    type: "strength",
    signal: "Goes straight to God for the interpretation of events and visions.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Daniel interpreting times and dreams.",
  },
  {
    id: "issachar-oil-partnership",
    tribeSlug: "issachar",
    type: "oil",
    signal: "Operates at full capacity when partnering with God to understand, not relying on raw analysis.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Daniel seeking God for the interpretation rather than guessing.",
  },
  {
    id: "issachar-shadow-overanalyze",
    tribeSlug: "issachar",
    type: "shadow",
    signal: "Over-analyzes and demands every risk be eliminated before obeying.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Turning to astrology and trends to read the times once cut off from God.",
  },
  {
    id: "issachar-fall-silence",
    tribeSlug: "issachar",
    type: "fallLine",
    signal: "Sees and knows what to do but stays silent out of fear of being wrong.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Paralysis from the fear of misdiagnosing the moment.",
  },

  // ── Zebulun · The Merchant ────────────────────────────────────────────────
  {
    id: "zebulun-strength-prosper",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Generates prosperity and converts the resulting influence into drawing people in.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Hiram mobilizing resources to build the temple.",
  },
  {
    id: "zebulun-strength-mobilize",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Mobilizes resources and creates expansion and enterprise.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Nehemiah organizing restoration and drawing people into the vision.",
  },
  {
    id: "zebulun-strength-platform",
    tribeSlug: "zebulun",
    type: "strength",
    signal: "Builds platforms and trade routes that become a stage for something greater.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Zebulun's Via Maris becoming the stage for the Gospel.",
  },
  {
    id: "zebulun-oil-give",
    tribeSlug: "zebulun",
    type: "oil",
    signal: "Stays healthy by giving resources away and asking what to multiply rather than what to keep.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Stewarding the flow of the trade route instead of hoarding it.",
  },
  {
    id: "zebulun-shadow-halfobedience",
    tribeSlug: "zebulun",
    type: "shadow",
    signal: "Settles for half-obedience, stopping short in the very area of their gift.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Zebulun leaving Canaanites in the land instead of driving them all out.",
  },
  {
    id: "zebulun-fall-greed",
    tribeSlug: "zebulun",
    type: "fallLine",
    signal: "Monetizes what should never have a price and measures everything by financial return.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Demas loving the present world and abandoning the mission.",
  },

  // ── Joseph · The Bull ─────────────────────────────────────────────────────
  {
    id: "joseph-strength-fortitude",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Maintains fortitude and steadiness in hostile, predatory environments.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Joseph holding integrity through the pit, the prison, and the famine.",
  },
  {
    id: "joseph-strength-administrate",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Brings order and administrates at large scale, often as the trusted second-in-command.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Joshua faithfully supporting Moses for forty years before leading.",
  },
  {
    id: "joseph-strength-forged",
    tribeSlug: "joseph",
    type: "strength",
    signal: "Is forged and strengthened through pain rather than broken by it.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Daniel keeping fortitude in the most predatory environment imaginable.",
  },
  {
    id: "joseph-oil-companionship",
    tribeSlug: "joseph",
    type: "oil",
    signal: "Stays warm and connected when witnessed and valued as a person, not just used for output.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "\"Come close to me... God sent me ahead of you.\"",
  },
  {
    id: "joseph-shadow-cold",
    tribeSlug: "joseph",
    type: "shadow",
    signal: "Turns pain into coldness, bitterness, cynicism, and held resentment.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Joseph's lingering coldness toward his brothers even after forgiving them.",
  },
  {
    id: "joseph-fall-detach",
    tribeSlug: "joseph",
    type: "fallLine",
    signal: "Cuts off from the source until resilience hardens into isolation and detachment.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Manasseh's collapse into idolatry before his prison repentance.",
  },

  // ── Benjamin · The Wolf ───────────────────────────────────────────────────
  {
    id: "benjamin-strength-hardplaces",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Comes alive in hard places and treats every situation as winnable.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Ehud's ruthless efficiency delivering Israel.",
  },
  {
    id: "benjamin-strength-protect",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Fiercely protective of their people, reading cultural danger to shield them.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Esther moving with precision to protect her people.",
  },
  {
    id: "benjamin-strength-cunning",
    tribeSlug: "benjamin",
    type: "strength",
    signal: "Smart and cunning, operating equally well in a pack or as a lone wolf.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Jonathan's fierce loyalty to God and David over his own inheritance.",
  },
  {
    id: "benjamin-oil-mission",
    tribeSlug: "benjamin",
    type: "oil",
    signal: "Operates at peak when given a clear, God-given enemy and mission to fight for.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Paul's ferocity redirected on the Damascus road.",
  },
  {
    id: "benjamin-shadow-war",
    tribeSlug: "benjamin",
    type: "shadow",
    signal: "Avoids looking weak at all costs and stays addicted to conflict even when no war was commissioned.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Saul's paranoid, self-made war against David.",
  },
  {
    id: "benjamin-fall-devour",
    tribeSlug: "benjamin",
    type: "fallLine",
    signal: "Turns on and devours the very people they were meant to protect.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "The Benjamites at Gibeah turning on their own people.",
  },

  // ── Dan · The Serpent ─────────────────────────────────────────────────────
  {
    id: "dan-strength-sentinel",
    tribeSlug: "dan",
    type: "strength",
    signal: "Sees threats and reads danger early — the sentinel who notices what others miss.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Nehemiah's strategic vigilance protecting the rebuild.",
  },
  {
    id: "dan-strength-discern",
    tribeSlug: "dan",
    type: "strength",
    signal: "Discerns patterns with predatory intelligence and quick reflexes.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Esther's pattern recognition turned toward protection.",
  },
  {
    id: "dan-strength-judge",
    tribeSlug: "dan",
    type: "strength",
    signal: "Holds positional awareness, judging situations as a watchman.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Dan called to judge his people as one of the tribes of Israel.",
  },
  {
    id: "dan-oil-trust",
    tribeSlug: "dan",
    type: "oil",
    signal: "Becomes a wise counselor when trusting God's faithfulness instead of their own vigilance.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Samson's final, surrendered, trusting move.",
  },
  {
    id: "dan-shadow-cynicism",
    tribeSlug: "dan",
    type: "shadow",
    signal: "Trusts their own vigilance over God until discernment calcifies into cynicism.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Jeroboam's fear of deception building the architecture of deception.",
  },
  {
    id: "dan-fall-idolatry",
    tribeSlug: "dan",
    type: "fallLine",
    signal: "Lets corrupted judgment harden into idolatry and self-deception.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "The serpent using discernment to sow doubt — \"Did God really say?\"",
  },

  // ── Naphtali · The Deer ───────────────────────────────────────────────────
  {
    id: "naphtali-strength-freedom",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Brings freedom and healing to others, especially out of their own past pain.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Anna emerging from loss as a freedom-bringer who recognized Jesus.",
  },
  {
    id: "naphtali-strength-beauty",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Carries beauty, expression, and encouragement that lifts and heals people.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Bezalel's Spirit-filled artistry building the Tabernacle.",
  },
  {
    id: "naphtali-strength-transition",
    tribeSlug: "naphtali",
    type: "strength",
    signal: "Called to oversee transitions and lead others into liberation.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Miriam leading Israel in song after deliverance.",
  },
  {
    id: "naphtali-oil-mission",
    tribeSlug: "naphtali",
    type: "oil",
    signal: "Thrives when their movement toward freedom is framed as mission for others, not flight.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "The people in darkness seeing a great light (Isaiah 9).",
  },
  {
    id: "naphtali-shadow-avoidpain",
    tribeSlug: "naphtali",
    type: "shadow",
    signal: "Avoids the very pain that qualifies them, fearing captivity and heaviness.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Miriam's criticism of Moses as the gift turns inward.",
  },
  {
    id: "naphtali-fall-escapism",
    tribeSlug: "naphtali",
    type: "fallLine",
    signal: "Turns the gift of beauty inward into escapism and self-display.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Running away from pain rather than carrying others out of it.",
  },

  // ── Asher · The Olive Tree ────────────────────────────────────────────────
  {
    id: "asher-strength-atmosphere",
    tribeSlug: "asher",
    type: "strength",
    signal: "Creates atmospheres where people are fed, welcomed, and enriched.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Barnabas making others flourish.",
  },
  {
    id: "asher-strength-generous",
    tribeSlug: "asher",
    type: "strength",
    signal: "Generous to the point of giving everything to make others flourish.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Barnabas selling his land and giving the proceeds.",
  },
  {
    id: "asher-strength-host",
    tribeSlug: "asher",
    type: "strength",
    signal: "Hosts and nourishes instinctively, calming and enriching a room.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Abigail's nourishing wisdom defusing David's wrath.",
  },
  {
    id: "asher-oil-enrich",
    tribeSlug: "asher",
    type: "oil",
    signal: "Comes alive creating an environment that nourishes others.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "The woman at the well becoming a generous hostess to her village.",
  },
  {
    id: "asher-shadow-comfort",
    tribeSlug: "asher",
    type: "shadow",
    signal: "Sinks into comfort, passivity, and people-pleasing that mainly serves their own ease.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Martha's anxious over-function missing the one thing needed.",
  },
  {
    id: "asher-fall-enabler",
    tribeSlug: "asher",
    type: "fallLine",
    signal: "Avoids friction at all costs until the peacemaker becomes an enabler.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Abigail bound to Nabal's dysfunction.",
  },

  // ── Gad · The Raider ──────────────────────────────────────────────────────
  {
    id: "gad-strength-grit",
    tribeSlug: "gad",
    type: "strength",
    signal: "Brings frontline grit and refuses to quit under pressure.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "The Gadites crossing the Jordan in flood season.",
  },
  {
    id: "gad-strength-rebuild",
    tribeSlug: "gad",
    type: "strength",
    signal: "Rebuilds and resists in the hardest places others avoid.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Nehemiah rebuilding with a tool in one hand and a weapon in the other.",
  },
  {
    id: "gad-strength-endure",
    tribeSlug: "gad",
    type: "strength",
    signal: "Endures and survives on the forgotten ground where no one else will go.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Gadite warriors with faces like lions, swift as gazelles.",
  },
  {
    id: "gad-oil-rest",
    tribeSlug: "gad",
    type: "oil",
    signal: "Sustained only by rest — the thing that keeps them functioning and the thing they resist most.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "God feeding Elijah under the juniper tree instead of assigning a mission.",
  },
  {
    id: "gad-shadow-overwhelm",
    tribeSlug: "gad",
    type: "shadow",
    signal: "Driven by a fear of collapse and overwhelm despite being built to endure.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Treating rest as betrayal rather than survival.",
  },
  {
    id: "gad-fall-burnout",
    tribeSlug: "gad",
    type: "fallLine",
    signal: "Pushes past every limit because stopping feels like letting people down, until burnout forces collapse.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Elijah's \"I have had enough, Lord\" under the juniper tree.",
  },

  // ── Reuben · The Firstborn ────────────────────────────────────────────────
  {
    id: "reuben-strength-potential",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Carries unusually high potential and capacity — wired to lead and to carry the blessing.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Reuben as the firstborn, the first fruits of his father's strength.",
  },
  {
    id: "reuben-strength-anointing",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Holds a firstborn anointing meant to carry and bless others.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Caleb's capacity held under constraint, then fully released.",
  },
  {
    id: "reuben-strength-instinct",
    tribeSlug: "reuben",
    type: "strength",
    signal: "Has the right protective instinct toward leading and rescuing.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Reuben moving to save Joseph's life at the pit.",
  },
  {
    id: "reuben-oil-constraint",
    tribeSlug: "reuben",
    type: "oil",
    signal: "Grows into authority through mentored constraint framed as initiation, not punishment.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "Gideon initiated through decreasing resources and increasing faith.",
  },
  {
    id: "reuben-shadow-impulsive",
    tribeSlug: "reuben",
    type: "shadow",
    signal: "Unstable and impulsive, giving away authority through a lack of restraint.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "Early Saul's overzealous, impulsive decisions.",
  },
  {
    id: "reuben-fall-immorality",
    tribeSlug: "reuben",
    type: "fallLine",
    signal: "Forfeits the blessing — the most to gain — through the appetite they could not contain.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "Samson's maximum potential lost to having zero container.",
  },

  // ── Simeon · The Blade ────────────────────────────────────────────────────
  {
    id: "simeon-strength-zeal",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Burns with zeal for holiness and acts on deep conviction.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Phinehas's Spirit-led zeal rewarded with a covenant of peace.",
  },
  {
    id: "simeon-strength-hearing",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Deeply attuned to God's voice and to what truly matters — the buried 'Hearing' gift.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "Simeon the Righteous discerning the moment when he held Jesus.",
  },
  {
    id: "simeon-strength-decisive",
    tribeSlug: "simeon",
    type: "strength",
    signal: "Action-oriented and decisive in defense of what is right.",
    weight: WEIGHT_BY_TYPE.strength,
    exemplar: "John the Baptist's uncompromising conviction pointed toward grace.",
  },
  {
    id: "simeon-oil-mercy",
    tribeSlug: "simeon",
    type: "oil",
    signal: "Healthiest when conviction is infused with mercy — judgment that has learned the heart behind the law.",
    weight: WEIGHT_BY_TYPE.oil,
    exemplar: "\"Mercy triumphs over judgment\" (James 2:13).",
  },
  {
    id: "simeon-shadow-nomercy",
    tribeSlug: "simeon",
    type: "shadow",
    signal: "Holds conviction with zero mercy, grasping the rules of God but not His intent.",
    weight: WEIGHT_BY_TYPE.shadow,
    counterExemplar: "The Pharisees' passionate conviction without compassion.",
  },
  {
    id: "simeon-fall-cruelty",
    tribeSlug: "simeon",
    type: "fallLine",
    signal: "Lets conviction curdle into cruelty, even premeditated deception to enable it.",
    weight: WEIGHT_BY_TYPE.fallLine,
    counterExemplar: "The Shechem massacre — deception followed by violence.",
  },
];

export class MarkerCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkerCatalogError";
  }
}

/**
 * Asserts the catalog's invariants and throws `MarkerCatalogError` on the first
 * violation. Runs at module load against the real catalog so authoring drift
 * fails loudly, and is exported so tests can validate deliberately-broken
 * catalogs.
 *
 * Checks, in order: marker integrity (non-empty unique id, valid type, bounded
 * weight), every `tribeSlug` resolves against `tribes.ts`, then even coverage
 * across all 12 tribes.
 */
export function validateMarkerCatalog(
  catalog: readonly Marker[],
  validSlugs: ReadonlySet<string> = new Set(tribes.map((t) => t.slug)),
  tolerance: number = COVERAGE_TOLERANCE,
): void {
  const seenIds = new Set<string>();

  for (const marker of catalog) {
    if (!marker.id) {
      throw new MarkerCatalogError("Marker is missing an id.");
    }
    if (seenIds.has(marker.id)) {
      throw new MarkerCatalogError(`Duplicate marker id: ${marker.id}`);
    }
    seenIds.add(marker.id);

    if (!MARKER_TYPES.includes(marker.type)) {
      throw new MarkerCatalogError(
        `Marker ${marker.id} has an invalid type: ${String(marker.type)}`,
      );
    }
    if (
      typeof marker.weight !== "number" ||
      Number.isNaN(marker.weight) ||
      marker.weight < MIN_WEIGHT ||
      marker.weight > MAX_WEIGHT
    ) {
      throw new MarkerCatalogError(
        `Marker ${marker.id} has an out-of-bounds weight: ${String(marker.weight)}`,
      );
    }
    if (!validSlugs.has(marker.tribeSlug)) {
      throw new MarkerCatalogError(
        `Marker ${marker.id} references an unknown tribe slug: ${marker.tribeSlug}`,
      );
    }
  }

  // Even coverage: count per valid slug (every tribe starts at 0 so an
  // uncovered tribe is caught), then bound the spread by the tolerance.
  const counts = new Map<string, number>();
  for (const slug of validSlugs) counts.set(slug, 0);
  for (const marker of catalog) {
    counts.set(marker.tribeSlug, (counts.get(marker.tribeSlug) ?? 0) + 1);
  }

  const values = [...counts.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > tolerance) {
    const detail = [...counts.entries()]
      .map(([slug, n]) => `${slug}=${n}`)
      .join(", ");
    throw new MarkerCatalogError(
      `Uneven Marker coverage across tribes (spread ${max - min} > tolerance ${tolerance}): ${detail}`,
    );
  }
}

// Fail loudly at import if the authored catalog ever drifts out of spec.
validateMarkerCatalog(markerCatalog);

/** Total number of Markers in the catalog. */
export const MARKER_COUNT = markerCatalog.length;

/** Every Marker authored for the given tribe slug. */
export function markersForTribe(slug: string): Marker[] {
  return markerCatalog.filter((m) => m.tribeSlug === slug);
}

/** Look up a single Marker by its stable id. */
export function getMarkerById(id: string): Marker | undefined {
  return markerCatalog.find((m) => m.id === id);
}
