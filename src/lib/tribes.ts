export type TribeStatus = "active" | "disqualified" | "warning" | "disqualified-arc";

export interface NotablePerson {
  name: string;
  reference: string;
  description: string;
}

export interface Tribe {
  number: number;
  name: string;
  callSign: string;
  slug: string;
  status: TribeStatus;
  keyScripture: string;
  keyScriptureRef: string;
  strengths: string;
  shadowConstraints: string;
  oil: string;
  oilScripture?: string;
  oilScriptureRef?: string;
  fallLine: string;
  notablePeople: NotablePerson[];
  theNote: string;
  hasZeal?: boolean;
  color: string; // tailwind color class for accent
}

export const tribes: Tribe[] = [
  {
    number: 1,
    name: "Judah",
    callSign: "The Lion",
    slug: "judah",
    status: "active",
    hasZeal: true,
    color: "amber",
    keyScripture: "The scepter shall not depart from Judah, nor the ruler's staff from between his feet",
    keyScriptureRef: "Genesis 49:10",
    strengths: "Honor. Courage. Authority. Organizational. Forward-facing. Built for public office and burden-bearing. Sacrificial frontline leadership — they lead the conquest, not observe it. Raw firepower. Marked with zeal.",
    shadowConstraints: "Fear of insignificance. Terrified of losing influence. Tempted toward dominion. Vain — confuses visibility with significance, presence with impact. Will consume what belongs to others when operating in shadow.",
    oil: "Responsibility. Weight. They come alive when duty is piled on their shoulders. They want the ball in the 4th quarter. No weight = no significance. Ratchet the pressure up — that's when they're most themselves.",
    fallLine: "Abuse of power. Sexual immorality.",
    notablePeople: [
      {
        name: "David",
        reference: "2 Samuel 1–24",
        description: "The complete profile — frontline courage, raw authority, sacrificial leadership. Also the complete fall line: abuse of power, Bathsheba, murder of Uriah. David is Judah in full — the heights and the depths.",
      },
      {
        name: "Caleb",
        reference: "Numbers 13–14, Joshua 14",
        description: "Stood against 10 fearful spies, maintained conviction for 45 years, then asked for the hardest mountain. The purest expression of Judah's strength without the shadow consuming him.",
      },
      {
        name: "Josiah",
        reference: "2 Kings 22–23",
        description: "Radical reform at age 26. Zeal, honor, and courage. Died on the frontlines. Judah's strength without the vanity.",
      },
      {
        name: "Boaz",
        reference: "Ruth 2–4",
        description: "Honor and protective authority in everyday life. Used wealth for justice, not status. Public and dignified without being self-promoting.",
      },
      {
        name: "Asa",
        reference: "2 Chronicles 14–16",
        description: "Early courage and revival. Late shadow — fear of insignificance drove him to political alliances instead of God. The arc in a single life.",
      },
      {
        name: "Judas Iscariot",
        reference: "Matthew 26–27",
        description: "Cautionary. Wanted dominion, confused visibility with significance, monetized his position, abused access. The full shadow and fall.",
      },
    ],
    theNote: "Judah is one of three tribes marked with zeal — alongside Levi and Benjamin. But Judah's zeal carries weight and authority. It's the zeal of the one who stands out front, absorbs the burden, and leads the charge. The danger is that weight without God becomes ego. Significance without assignment becomes vanity. The Lion was always meant to serve the Kingdom — not become one.",
  },
  {
    number: 2,
    name: "Levi",
    callSign: "The Priest",
    slug: "levi",
    status: "active",
    hasZeal: true,
    color: "violet",
    keyScripture: "Let your Thummim and Urim belong to your faithful servant... They shall teach Jacob your rules and Israel your law",
    keyScriptureRef: "Deuteronomy 33:8–11",
    strengths: "Guards what is holy. Ruthless in defense of sacred things. Worship — the mediator between Heaven and Earth. Teaching and education. Set apart, consecrated, outsiders by design. What pleases God is their native language. Marked with zeal.",
    shadowConstraints: "Legalism. Spiritual elitism. Severity. Pharisaical. Fear leads to compromise — when the Levi loses their courage, they don't abandon the post, they just charge admission to it. They put a price on Godliness that not even God Himself ever charged.",
    oil: "Access — direct, unmediated encounter with the Holy. Levi's shadow comes from protecting access rather than having it. When they experience God's presence directly — not just managing the protocols around it — their zeal becomes authentic worship instead of enforcement. The oil isn't more rules. It's more encounter.",
    oilScripture: "Since we have confidence to enter the Most Holy Place... let us draw near to God with a sincere heart",
    oilScriptureRef: "Hebrews 10:19–22",
    fallLine: "Harshness. Religion without relationship. Using the Bible as a weapon. Gatekeeping access to God — they put a price on Godliness that not even God Himself ever charged.",
    notablePeople: [
      {
        name: "Phinehas",
        reference: "Numbers 25",
        description: "Levitical zeal at its peak. Ruthless defense of the sacred, earned an eternal covenant of priesthood. Zeal aimed at the right thing becomes lasting authority.",
      },
      {
        name: "John the Baptist",
        reference: "Luke 1",
        description: "Set people apart, prepared the way, refused to compromise truth even to his death. Zeal without gatekeeping.",
      },
      {
        name: "Aaron",
        reference: "Exodus 28–32",
        description: "Shadow: the golden calf. Fear leading to compromise — Levi's shadow in a single event. The priest who guarded the holy, caved when the crowd got loud.",
      },
      {
        name: "Eli",
        reference: "1 Samuel 1–4",
        description: "Religion without relationship. Maintained the form while the substance collapsed. The post was kept. The presence was gone.",
      },
      {
        name: "Ezra",
        reference: "Ezra 7–10",
        description: "Teaching and education at its finest. Restored covenant understanding after exile. Brought the law back not as a weapon but as restoration.",
      },
      {
        name: "The Pharisees",
        reference: "Matthew 23",
        description: "The full Levi fall line written in narrative. Jesus' entire rebuke in Matthew 23 is a precise map of what happens when the priest loses the presence and keeps the position.",
      },
    ],
    theNote: "Levi has no land inheritance. Every other tribe got territory — Levi got God. Numbers 18:20 — 'I am your share and your inheritance.' That is both the highest honor and the sharpest test. When Levi forgets that God Himself is the inheritance and starts building systems, titles, and structures to fill that space — religion replaces relationship and the priest becomes the gatekeeper. The redemption of Levi is always the same: get back in the room. Not to manage it. To encounter it.",
  },
  {
    number: 3,
    name: "Issachar",
    callSign: "The Sage",
    slug: "issachar",
    status: "active",
    color: "blue",
    keyScripture: "They understood the times and knew what Israel should do",
    keyScriptureRef: "1 Chronicles 12:32",
    strengths: "Obsessed with moments and timing. Pattern recognition. Student of history. Psychometrics. Goes straight to God. Understands the times to instruct people on what to do. Strong — built to carry weight (Genesis 49:14).",
    shadowConstraints: "Over-analyzes. Drifts toward 'New Age' — looks to astrology and whatever else helps them read the times when they lose their source. Must have risk eliminated before they'll obey.",
    oil: "Partnering with God to understand. Seeking Godly understanding — when connected to the right source, their gift operates at full capacity.",
    fallLine: "Slow to respond. Will go around God to get understanding. Cowardice — they see it, they know it, but fear keeps them silent. Fear of misdiagnosing the moment, fear of being wrong and its consequences — so they do nothing.",
    notablePeople: [
      {
        name: "The Men of Issachar",
        reference: "1 Chronicles 12:32",
        description: "'Understood the times, knew what Israel should do.' 200 men who changed the course of a kingdom.",
      },
      {
        name: "Deborah",
        reference: "Judges 4–5",
        description: "Pattern recognition and instruction. Told Barak what to do, when to move, and why. The sage in action.",
      },
      {
        name: "Daniel",
        reference: "Daniel 1–6",
        description: "Understood visions and times, went straight to God for interpretation, instructed kings. Issachar's oil working perfectly — partnership with God producing understanding.",
      },
      {
        name: "Samuel",
        reference: "1 Samuel 3–25",
        description: "Knew what Israel should do through intimate connection with God. Read cultural moments with precision. Shadow: refused to release control over his chosen leader.",
      },
      {
        name: "Ezra",
        reference: "Ezra 7–10",
        description: "Studied scripture deeply, applied it to current circumstances, provided clear direction without overstepping.",
      },
    ],
    theNote: "Issachar's gift is only as good as their source. When connected to God, they see what no one else sees and speak with clarity that moves nations. When disconnected, they look for the pattern everywhere else — astrology, trends, analytics, whatever helps. Isaiah 47:13-14 calls this out directly. The sage who goes around God doesn't lose their ability to read the times. They just start reading them wrong.",
  },
  {
    number: 4,
    name: "Zebulun",
    callSign: "The Merchant",
    slug: "zebulun",
    status: "active",
    color: "emerald",
    keyScripture: "Blessed to go out, create abundance, and draw people in",
    keyScriptureRef: "Deuteronomy 33:18 | Genesis 49 | Joshua 19:10",
    strengths: "Gifted in prosperity — and prosperity creates influence. Resource mobilization. Creates expansion. Enterprise. Blessed by Moses to go out, generate abundance, and draw people in.",
    shadowConstraints: "Tempted toward half obedience — Zebulun failed to drive out ALL the Canaanites, they just stopped short (Judges 1:30). The Canaanite is the land of merchants, abundance, and prosperity — their shadow lives in the very thing they're gifted in.",
    oil: "Give stuff away — don't hoard. Momentum keeps them moving forward. Set tracks and markers. Ask what to multiply, not what to keep.",
    fallLine: "Greed. Monetizing what shouldn't be monetized. Reducing everything to charts and a money lens — when the Zebulun falls, they measure everything by financial return, including things that were never meant to have a price.",
    notablePeople: [
      {
        name: "Hiram of Tyre",
        reference: "1 Kings 5–7",
        description: "Resource mobilization for the temple. Enterprise creating kingdom influence. The Zebulun gift serving something greater than profit.",
      },
      {
        name: "Solomon",
        reference: "1 Kings 4–10",
        description: "Massive prosperity and influence through merchant networks. Also the shadow — 700 wives, half obedience, monetized everything including relationships.",
      },
      {
        name: "Nehemiah",
        reference: "Nehemiah 1–13",
        description: "Mobilized resources, drew people into vision, organized restoration. Zebulun's gift aimed at rebuilding.",
      },
      {
        name: "Demas",
        reference: "2 Timothy 4:10",
        description: "'Loved the present world and abandoned Paul.' Zebulun's shadow: greed reduces people to transactions. The merchant who chose the world over the mission.",
      },
    ],
    theNote: "Zebulun's territory included the Via Maris — the Way of the Sea — the most important trade route in the ancient world. Everything flowed through their land. That was by design. The Merchant was never meant to hoard the flow — they were meant to steward it. When Jesus began His ministry, He set up in Zebulun's territory (Matthew 4:13). The platform Zebulun built became the stage for the Gospel. That's what the gift is for.",
  },
  {
    number: 5,
    name: "Joseph",
    callSign: "The Bull",
    slug: "joseph",
    status: "active",
    color: "orange",
    keyScripture: "With bitterness archers attacked him... But his bow remained steady, his strong arms stayed limber, because of the hand of the Mighty One of Jacob",
    keyScriptureRef: "Genesis 49:23–24",
    strengths: "Resistance. Maintains fortitude in predatory environments. Controls and administrates at large scale. Order and organization. The ultimate 2nd in command — built to work behind the scenes. Supports someone else's mission and calling. Instrumental. Trained by resilience — forged through pain.",
    shadowConstraints: "Misuses pain. Becomes cold. Bitter. Cynical. Holds resentment. The enemy's primary target is their gift — Baal specifically wants to corrupt what the Bull carries.",
    oil: "Trusted Companionship — being witnessed in the labor. Joseph doesn't need praise for outcomes. He needs someone who sees his integrity in the pit, in the prison, in the famine — and affirms his personhood beyond his utility. When he knows he's loved as a person and not just used as a tool, he stays warm and connected. Without it, he goes cold.",
    oilScripture: "Come close to me... do not be distressed... God sent me ahead of you",
    oilScriptureRef: "Genesis 45:4–5",
    fallLine: "Cold. Detachment. Powerless. Not connecting to God — when the Bull cuts off from the source, the resilience that was their strength becomes isolation.",
    notablePeople: [
      {
        name: "Joseph",
        reference: "Genesis 37–50",
        description: "The complete profile. Betrayed, enslaved, falsely accused, imprisoned — maintained fortitude through every predatory environment. Always 2nd in command, always instrumental. Shadow: emotional coldness toward his brothers even after forgiving them.",
      },
      {
        name: "Joshua",
        reference: "Joshua 1–24",
        description: "Faithful support of Moses' mission for 40 years before leading anything himself. Organizational strength, resistance through the wilderness.",
      },
      {
        name: "Gideon",
        reference: "Judges 6–8",
        description: "Resistance and fortitude — terrified but moved forward. Strategic precision. Fall: built his own empire through the ephod after the victory.",
      },
      {
        name: "Jephthah",
        reference: "Judges 11–12",
        description: "Forged through rejection and pain, led to victory. Tragic fall: misused pain, became cold and uncompromising, his rash vow cost him everything.",
      },
      {
        name: "King Manasseh",
        reference: "2 Chronicles 33",
        description: "The shadow at its darkest — detached, idolatrous, violent. Then repented from prison and was restored. The full arc: Bull in total collapse, then Bull redeemed.",
      },
      {
        name: "Daniel",
        reference: "Daniel 1–6",
        description: "Maintained fortitude in the most predatory environment imaginable. Never lost his connection to God. The Bull with the oil working — companionship with God kept him warm when everything around him was hostile.",
      },
    ],
    theNote: "The Bull is the most targeted tribe. Genesis 49:23 says it plainly — 'with bitterness archers attacked him.' The enemy knows what the Bull carries and comes after it specifically. Because when the Bull is connected, aligned, and warm, entire nations get fed. The gift is that significant. Which is exactly why the fall into coldness and detachment is that dangerous — a disconnected Bull doesn't just hurt themselves. The people who were supposed to be fed go hungry.",
  },
  {
    number: 6,
    name: "Benjamin",
    callSign: "The Wolf",
    slug: "benjamin",
    status: "active",
    hasZeal: true,
    color: "red",
    keyScripture: "Benjamin is a ravenous wolf; in the morning he devours the prey, in the evening he divides the spoils",
    keyScriptureRef: "Genesis 49:27",
    strengths: "Fierce. Intense. Reads culture. A rock. Protective of people. Smart and cunning. Everything is winnable. Built for hard places — drop them in and they come alive. Pack mentality, but fully capable of operating as a lone wolf. Marked with zeal.",
    shadowConstraints: "Fear of vulnerability — avoids being seen as weak, dumb, or scared at all costs. Becomes intimidating and impulsive. Constantly fighting a war even when God never commissioned it. Addicted to war and chaos.",
    oil: "Needs a clear enemy. Clear mission. Something to fight for — without a God-given target, the warfare turns inward or sideways. Give them a hill to take and they're the most dangerous person in the room.",
    fallLine: "Devours what is good because they couldn't turn the warfare off. Attaches to people, then devours them when threatened. Commissioned to building their own empire. Disloyal. Devours what they were meant to protect.",
    notablePeople: [
      {
        name: "Paul",
        reference: "Romans 11:1, Philippians 3:5",
        description: "The redemption arc. Same ferocity, completely redirected. Damascus Road turned the wolf loose on the right enemy. 2 Corinthians 11 is Benjamin at full capacity for the right mission.",
      },
      {
        name: "Jonathan",
        reference: "1 Samuel 14, 18–20",
        description: "Benjamin at its absolute best. Fierce and loyal — but loyal to God and David, not to his own empire. Willing to lay down his inheritance for the right thing.",
      },
      {
        name: "Esther",
        reference: "Esther 2–10",
        description: "Read the cultural danger and moved with precision to protect her people. 'If I perish, I perish.' The wolf protecting the pack.",
      },
      {
        name: "Ehud",
        reference: "Judges 3:12–30",
        description: "Clear enemy, clear mission, ruthless efficiency. Read the moment and delivered Israel.",
      },
      {
        name: "Saul",
        reference: "1 Samuel 9–31",
        description: "The full shadow and fall. Everything winnable — then addicted to his own war, paranoid, empire-building, destroyed by what he couldn't surrender.",
      },
      {
        name: "The Benjamites at Gibeah",
        reference: "Judges 19–21",
        description: "No clear enemy, turned on their own people, nearly extinct. Benjamin with no God-given mission is Benjamin at war with itself.",
      },
    ],
    theNote: "Benjamin is one of three tribes marked with zeal — alongside Judah and Levi. The difference is what the zeal is aimed at. Judah's zeal carries weight and authority. Levi's zeal guards the sacred. Benjamin's zeal fights. When it has a righteous target, it's unstoppable. When it doesn't, it consumes everything around it — including itself.",
  },
  {
    number: 7,
    name: "Dan",
    callSign: "The Serpent",
    slug: "dan",
    status: "disqualified",
    color: "slate",
    keyScripture: "Dan shall judge his people as one of the tribes of Israel. Dan shall be a serpent in the way, a horned snake in the path",
    keyScriptureRef: "Genesis 49:16–17",
    strengths: "Discernment. Pattern recognition. Strategic vigilance — the sentinel/watchman. Quick reflexes, predatory intelligence, ability to read threats before others see them. Positional awareness. Dan's gift is being the one who sees what no one else sees.",
    shadowConstraints: "Fear of perversion of truth. Fear of being deceived. Draws in cynics because of bitterness. Set up false priesthood when the real thing felt out of reach (Judges 18). Catastrophic misread of the moment — gave us Barabbas.",
    oil: "Trust (Emunah) — unwavering confidence in God's faithfulness. Dan reads the threat correctly but then trusts his own vigilance instead of God. Without trust, discernment calcifies into cynicism, strategy into deception, vigilance into control. With trust, Dan becomes the wise counselor and strategic protector.",
    oilScripture: "Trust in the Lord with all your heart and lean not on your own understanding",
    oilScriptureRef: "Proverbs 3:5–6",
    fallLine: "Idolatry. Absent from Revelation 7. The gift of judgment, corrupted, becomes the thing that removes them from the room entirely.",
    notablePeople: [
      {
        name: "Samson",
        reference: "Judges 13–16",
        description: "The tragic arc. Discernment and strength given, fell repeatedly by trusting his own eyes. Final redemption: blind, surrendered, trusting God for one last move. Dan's gift and fall in one life.",
      },
      {
        name: "Nehemiah",
        reference: "Nehemiah 1–13",
        description: "Dan's gift redeemed — discernment + strategic vigilance used to protect and build, not spread cynicism.",
      },
      {
        name: "Esther",
        reference: "Esther 2–10",
        description: "Pattern recognition turned toward protection. Vigilance that rescues instead of isolates.",
      },
      {
        name: "Jeroboam I",
        reference: "1 Kings 12–14",
        description: "Dan's shadow in full. Fear of losing power → built false priesthood, set up golden calves at Dan. Fear of deception became the architect of deception.",
      },
      {
        name: "The Serpent",
        reference: "Genesis 3",
        description: "Has discernment, uses it to sow doubt. 'Did God really say?' is the birthplace of cynicism — intelligence weaponized against trust.",
      },
    ],
    theNote: "Dan's redemption comes through surrendering control and admitting blindness — spiritual blindness despite keen observation. Samson's final act says it all: blind, arms around the pillars, trusting God with one last move. That is Dan redeemed. The sentinel who finally stops watching the door and trusts the One who never sleeps.",
  },
  {
    number: 8,
    name: "Naphtali",
    callSign: "The Deer",
    slug: "naphtali",
    status: "active",
    color: "cyan",
    keyScripture: "Naphtali is a doe set free that bears beautiful fawns",
    keyScriptureRef: "Genesis 49:21",
    strengths: "Brings freedom to others. Beauty. Expression. Encouragement. Called in to oversee transitions. To heal and oversee. The best healers — but only because they went through it first. Their fall and pain, surrendered to God, becomes the very thing that heals others.",
    shadowConstraints: "Fear of rejecting others because of personal rejection. Avoids pain — which is the exact thing that qualifies them. Fears captivity and heaviness.",
    oil: "Sanctioned Outward Mission — freedom commissioned for others. Naphtali thrives when their natural movement toward freedom is framed as ministry rather than flight. They need permission and structure that channels their healing energy toward others. The oil redirects it: your speed and beauty are meant to carry others out, not just you.",
    oilScripture: "The people living in darkness have seen a great light",
    oilScriptureRef: "Isaiah 9:1–2",
    fallLine: "Escapism. Self-expression — when the Naphtali falls, the gift of beauty and expression turns inward and becomes about them rather than the people they were sent to heal.",
    notablePeople: [
      {
        name: "Deborah",
        reference: "Judges 4–5",
        description: "Called Barak to lead, brought freedom to an oppressed nation through inspiration. Her song celebrates liberation — beauty and expression in service of freedom.",
      },
      {
        name: "Bezalel",
        reference: "Exodus 31, 35",
        description: "Filled with the Spirit specifically for artistic creation. Built the Tabernacle — beauty that healed Israel's relationship with God.",
      },
      {
        name: "Miriam",
        reference: "Exodus 15",
        description: "Led Israel in celebratory song after deliverance. Brought freedom through music and expression. Shadow: criticism of Moses shows the gift turning inward.",
      },
      {
        name: "Anna the Prophetess",
        reference: "Luke 2:36–38",
        description: "Went through loss, emerged as a freedom-bringer. Recognized Jesus and spoke redemption to all who were looking. Went through it first, helped others through it.",
      },
    ],
    theNote: "Jesus launched His entire earthly ministry in Naphtali's territory. Matthew 4:12-16 — 'The people living in darkness have seen a great light.' The land itself was anointed for healing and freedom. That was not accidental. Naphtali's calling is to be the place where the light breaks through. The danger is when the deer runs — not toward others, but away from the pain that makes the light possible.",
  },
  {
    number: 9,
    name: "Asher",
    callSign: "The Olive Tree",
    slug: "asher",
    status: "active",
    color: "lime",
    keyScripture: "Most blessed of sons is Asher... he will provide delicacies fit for a king",
    keyScriptureRef: "Genesis 49:20 | Deuteronomy 33:24–25",
    strengths: "Nourishment. Generosity. Hospitality. Creates enriching atmospheres. Built to create environments where people are fed, welcomed, and enriched.",
    shadowConstraints: "Addiction to comfort. Passivity. Over-indulgence. People pleasing — but it's not for others, it makes them feel better about themselves.",
    oil: "Atmosphere — enriching. They come alive when they're creating an environment that nourishes others. This is where they find purpose and energy.",
    fallLine: "Scarcity mindset. Retreat. Insecure with lack of things. Avoids friction at all costs — the peacemaker becomes the enabler.",
    notablePeople: [
      {
        name: "Barnabas",
        reference: "Acts 4:36–37",
        description: "Sold land, gave everything. Created enriching atmospheres for Paul and John Mark. His legacy is entirely about making others flourish. Name literally means 'son of encouragement.'",
      },
      {
        name: "Abigail",
        reference: "1 Samuel 25",
        description: "Intercepted David's wrath with hospitality and wisdom. Nourishing, calm atmosphere in a crisis. Shadow: married to Nabal — enabling dysfunction.",
      },
      {
        name: "Martha",
        reference: "Luke 10:38–42",
        description: "Hospitality and nourishment as instinct. Also the warning — service becoming anxious over-function that misses intimacy. Jesus' rebuke is Asher's shadow named directly.",
      },
      {
        name: "Joseph of Arimathea",
        reference: "Matthew 27:57–60",
        description: "Used wealth to create dignified sacred space even in grief. Generosity that honors rather than hoards.",
      },
      {
        name: "The Woman at the Well",
        reference: "John 4",
        description: "Shadow to light arc. From isolated dysfunction to generous hostess inviting her whole village. Asher redeemed — becomes a source of living water for others.",
      },
    ],
    theNote: "Asher's name means happy or blessed. They carry the anointing of abundance — and that anointing is meant to flow. Proverbs 11:24-25 says it plainly: 'One person gives freely, yet gains even more; another withholds unduly, but comes to poverty.' The Olive Tree that stops producing oil doesn't become something else. It just stops being what it was made to be.",
  },
  {
    number: 10,
    name: "Gad",
    callSign: "The Raider",
    slug: "gad",
    status: "disqualified-arc",
    color: "zinc",
    keyScripture: "Gad shall be raided by raiders, but he shall raid at their heels",
    keyScriptureRef: "Genesis 49:19",
    strengths: "Frontline grit. Resistance. Rebuilding under pressure. Doesn't quit. Survival. Drawn to where no one else will go — the hard places, the forgotten ground.",
    shadowConstraints: "Fear of collapse. Fear of overwhelm — ironic for the one built to endure everything.",
    oil: "Rest. That's it. Rest is the thing that keeps the Gad functioning — and the thing they resist most. They treat rest like betrayal. It is actually survival.",
    oilScripture: "Come to me, all you who are weary and burdened, and I will give you rest",
    oilScriptureRef: "Matthew 11:28",
    fallLine: "Burnout. Rest feels like letting people down — so they never stop, until they break. And then they don't just stop — they collapse.",
    notablePeople: [
      {
        name: "The Gadite Warriors",
        reference: "1 Chronicles 12:8–15",
        description: "'Faces like lions, swift as gazelles.' One of the least equal to a hundred. Crossed the Jordan in flood season — went where no one else would go.",
      },
      {
        name: "Elijah",
        reference: "1 Kings 17–19",
        description: "The Gad arc perfectly. Frontline prophet, unrelenting, drew to the hardest assignments. Then 1 Kings 19 — total burnout under a juniper tree. 'I have had enough, Lord.' REST was the oil God prescribed — and God honored it.",
      },
      {
        name: "Nehemiah",
        reference: "Nehemiah 4–6",
        description: "Rebuilt under attack, never quit, held tools in one hand and weapons in the other. Gad's frontline grit in a builder.",
      },
    ],
    theNote: "Elijah is Gad's most complete picture. Called to the hardest assignments, drew to conflict, unrelenting — until he wasn't. Under the juniper tree God didn't rebuke him. He fed him. Twice. And then told him the journey was too great for him. That is Gad's oil in action: God meeting the exhausted warrior not with a mission, but with bread and rest. The warning of Gad's disqualification arc is this — Elijah got the bread and kept going. The tribe of Gad didn't.",
  },
  {
    number: 11,
    name: "Reuben",
    callSign: "The Firstborn",
    slug: "reuben",
    status: "warning",
    color: "yellow",
    keyScripture: "Reuben, you are my firstborn, my might, and the first fruits of my strength, excelling in honor, excelling in power. Turbulent as the waters, you will no longer excel",
    keyScriptureRef: "Genesis 49:3–4",
    strengths: "High potential. The firstborn anointing — wired to lead, built to carry the blessing. More capacity than almost any other tribe.",
    shadowConstraints: "Unstable. Impulsive. Gives away authority through lack of restraint. Over-zealous with no container.",
    oil: "Initiated Constraint — mentored limitation as initiation into deeper authority. Reuben doesn't receive constraint imposed as punishment — that's what Genesis 49 was and it broke him. But constraint given by someone he respects, framed as initiation into greater authority rather than loss of it — that's the oil. Restraint equals greater influence, not less.",
    oilScripture: "From everyone who has been given much, much will be required",
    oilScriptureRef: "Luke 12:48",
    fallLine: "Forfeits through sexual immorality. The firstborn blessing — the most to gain — lost through the one thing they couldn't control.",
    notablePeople: [
      {
        name: "Samson",
        reference: "Judges 13–16",
        description: "Maximum potential, zero container. Impulsive, sexually immoral, forfeited his anointing. The Reuben fall written in narrative form.",
      },
      {
        name: "Saul (early)",
        reference: "1 Samuel 9–13",
        description: "High potential, anointed, everything ahead of him. Impulsive decisions, overzealous action, gave away authority through lack of restraint.",
      },
      {
        name: "Solomon (late)",
        reference: "1 Kings 11",
        description: "Started with divine anointing and maximum capacity. Abandoned mentored constraint, forfeited it all through excess.",
      },
      {
        name: "Caleb",
        reference: "Numbers 13–14, Joshua 14",
        description: "Reuben redeemed. Firstborn capacity held under constraint for 45 years, then fully released. Initiated limitation becomes deeper authority.",
      },
      {
        name: "Gideon",
        reference: "Judges 6–8",
        description: "Reluctant firstborn energy. Initiated into authority through decreasing resources and increasing faith. Restrained power becomes greater power.",
      },
    ],
    theNote: "Reuben had the most. Firstborn, double portion, leadership of the brothers, the blessing. He also saved Joseph's life (Genesis 37:22) — the instinct was right. But he came back too late. He had the discernment but not the decisive authority. Not the container. Hebrews 12:16-17 draws the parallel directly to Esau: 'Afterward, when he wanted to inherit this blessing, he was rejected. He could not bring about any change of mind, though he sought the blessing with tears.' The firstborn who forfeits doesn't always lose dramatically. Sometimes they just keep arriving too late.",
  },
  {
    number: 12,
    name: "Simeon",
    callSign: "The Blade",
    slug: "simeon",
    status: "disqualified",
    color: "rose",
    keyScripture: "Cursed be their anger, so fierce, and their fury, so cruel! I will scatter them in Jacob and disperse them in Israel",
    keyScriptureRef: "Genesis 49:7",
    strengths: "Zeal for holiness. Passionate conviction. Action-oriented commitment. The name Simeon means 'Hearing' (Shama) — the buried gift is deep attunement to God's voice and what matters. The problem was never the conviction — it was conviction without wisdom, mercy, or proper authority.",
    shadowConstraints: "No mercy. Understands the rules of God but not His intent. Throws the baby out with the bathwater. Needs guidance and structure or the blade has no direction.",
    oil: "Mercy (Chesed) — conviction infused with compassion. Simeon has judgment with zero mercy. James 2:13 — 'Mercy triumphs over judgment' — is the exact inversion of Simeon's fall. The oil isn't less conviction. It's conviction that has learned the heart behind the law.",
    oilScripture: "Do justly, love mercy, walk humbly with your God",
    oilScriptureRef: "Micah 6:8",
    fallLine: "Advocate of cruelty with no balance (Genesis 34). Disqualified — scattered and absorbed. Simeon didn't just advocate cruelty — he initiated deception to enable it. The Shechem massacre was premeditated deception followed by violence.",
    notablePeople: [
      {
        name: "Simeon the Righteous",
        reference: "Luke 2:25–35",
        description: "The redemption picture. Righteous, devout, Spirit-led, waiting — not acting out of impatience. Speaks a hard word to Mary but does it with love and care. Conviction + mercy. This is Simeon with oil.",
      },
      {
        name: "Phinehas",
        reference: "Numbers 25:10–13",
        description: "Same zeal — but God redeemed it and gave him a covenant of peace. The difference: Spirit-led action, not self-directed vengeance.",
      },
      {
        name: "John the Baptist",
        reference: "Matthew 3, John 3:30",
        description: "Fierce, uncompromising conviction for holiness — but pointed toward grace, then decreased. Zeal that serves something higher.",
      },
      {
        name: "The Pharisees",
        reference: "Matthew 23",
        description: "Simeon's shadow collectively. Passionate conviction without compassion. Jesus' entire rebuke in Matthew 23 is the Simeon fall line in detail.",
      },
      {
        name: "Pre-conversion Saul",
        reference: "Acts 8:1–3",
        description: "Zeal for holiness turned into persecution. Scattering force until encounter with Jesus transformed conviction into grace. The Simeon arc in one life.",
      },
    ],
    theNote: "The redemption of Simeon is learning that the law and the prophets were always about mercy. The man named Simeon in Luke 2 got there — righteous, devout, filled with the Spirit, waiting. He didn't force the moment. He discerned it. And when he held Jesus, he didn't pronounce judgment. He blessed. That is the Simeon type fully redeemed: the blade that finally learned when to be sheathed.",
  },
];

export const statusLabels: Record<TribeStatus, string> = {
  active: "",
  disqualified: "Disqualified",
  warning: "Warning Tribe",
  "disqualified-arc": "Disqualified Arc",
};

export function getTribeBySlug(slug: string): Tribe | undefined {
  return tribes.find((t) => t.slug === slug);
}
