import Link from "next/link";
import { tribes } from "@/lib/tribes";

/** First Hebrew base letter, with vowel points (niqqud) stripped. */
function hebrewInitial(hebrew: string): string {
  return hebrew.replace(/[֑-ׇ]/g, "").charAt(0);
}

export default function Home() {
  return (
    <main className="min-h-screen bg-bone text-ink">
      {/* Nav */}
      <div className="max-w-[1040px] mx-auto px-8">
        <nav className="relative z-10 flex items-center justify-between py-7">
          <div className="font-serif text-[23px] font-semibold tracking-[0.04em]">
            Tribe<span className="text-gold">·</span>Index
          </div>
          <div className="flex gap-7 text-[12px] uppercase tracking-[0.18em] text-muted">
            <Link href="#twelve" className="transition-colors hover:text-ink">The Twelve</Link>
            <Link href="#twelve" className="transition-colors hover:text-ink">The Assessment</Link>
            <Link href="#twelve" className="transition-colors hover:text-ink">About</Link>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <header className="relative overflow-hidden py-[116px] text-center md:py-[130px]">
        <div className="sun" aria-hidden="true" />
        <div className="relative z-[2] mx-auto max-w-[1040px] px-8">
          <div className="font-hebrew text-[clamp(22px,3.2vw,30px)] font-light tracking-[0.22em] text-gold mb-[26px]">
            שִׁבְטֵי יִשְׂרָאֵל
          </div>
          <h1 className="font-serif font-semibold text-ink leading-[1.04] tracking-[0.005em] text-[clamp(44px,7.2vw,82px)]">
            The world handed you
            <br />
            a role. Heaven wrote
            <br />
            you a{" "}
            <span className="font-display font-bold uppercase tracking-[0.02em] text-gold text-[0.92em]">
              name
            </span>
            .
          </h1>
          <p className="mx-auto mt-7 max-w-[540px] text-[18.5px] text-muted">
            An identity you did not choose and cannot earn — only step into.
            Twelve ancient archetypes to help you find it.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-[22px]">
            <Link
              href="#twelve"
              className="rounded-[2px] bg-ink px-[34px] py-[15px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
            >
              Take the Assessment
            </Link>
            <Link
              href="#twelve"
              className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
            >
              Explore the tribes
            </Link>
          </div>
        </div>
      </header>

      {/* The Twelve */}
      <div className="max-w-[1040px] mx-auto px-8">
        <section id="twelve">
          <div className="flex items-baseline justify-between border-b border-ink pb-1.5 pt-6">
            <h2 className="font-serif text-[30px] font-semibold">The Twelve Tribes</h2>
            <span className="font-hebrew text-[20px] font-normal text-gold">הַשְּׁבָטִים</span>
          </div>

          <div>
            {tribes.map((tribe) => (
              <Link
                key={tribe.slug}
                href={`/tribes/${tribe.slug}`}
                className="tribe-row"
                style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
              >
                {/* Hebrew initial + index */}
                <div className="flex flex-col items-start gap-1.5">
                  <span
                    className="font-hebrew text-[46px] font-medium leading-[0.9] max-[820px]:text-[38px]"
                    style={{ color: "var(--accent)" }}
                  >
                    {hebrewInitial(tribe.hebrew)}
                  </span>
                  <span className="text-[11px] tracking-[0.18em] text-faint tabular-nums">
                    {String(tribe.number).padStart(2, "0")} / 12
                  </span>
                </div>

                {/* Name + call sign + essence */}
                <div>
                  <h3 className="font-serif text-[30px] font-semibold leading-[1.02] max-[520px]:text-[25px]">
                    {tribe.name}
                  </h3>
                  <div className="font-serif text-[18px] italic text-muted mt-px">
                    {tribe.callSign} · <span className="font-hebrew not-italic">{tribe.hebrew}</span>
                  </div>
                  <div className="mt-[11px] text-[10.5px] uppercase tracking-[0.13em] text-faint">
                    {tribe.essence}
                  </div>
                </div>

                {/* Scripture */}
                <div className="row-scripture font-serif text-[18px] italic leading-[1.45] text-muted [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] overflow-hidden">
                  &ldquo;{tribe.keyScripture}&rdquo;
                  <span className="block font-sans not-italic text-[11px] tracking-[0.08em] uppercase text-faint mt-[7px]">
                    {tribe.keyScriptureRef}
                  </span>
                </div>

                {/* Arrow */}
                <div className="justify-self-end">
                  <span className="row-arrow text-[20px] text-hair transition-[color,transform] duration-200">
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Closing */}
      <section className="relative overflow-hidden py-[110px] text-center">
        <blockquote className="relative z-[2] mx-auto max-w-[760px] font-serif text-[clamp(26px,4vw,42px)] font-medium italic leading-[1.28]">
          &ldquo;They understood the times, and knew what they were to do.&rdquo;
        </blockquote>
        <cite className="relative z-[2] mt-[22px] block text-[12px] not-italic uppercase tracking-[0.22em] text-gold">
          1 Chronicles 12:32
        </cite>
      </section>

      <footer className="border-t border-hair py-[34px] text-center text-[12px] uppercase tracking-[0.14em] text-faint">
        Tribe Index — A framework for self-discovery, calling &amp; the celebration of strength
      </footer>
    </main>
  );
}

/** Maps a tribe's Tailwind color name to the accent hex used for the row bar + initial. */
function accentHex(color: string): string {
  const map: Record<string, string> = {
    amber: "#b8860b",
    violet: "#7c5cbf",
    blue: "#2f6fb0",
    emerald: "#2f8f63",
    orange: "#c2691f",
    red: "#b23535",
    slate: "#6b7280",
    cyan: "#1f97aa",
    lime: "#6f9420",
    zinc: "#7c7c85",
    yellow: "#b8961a",
    rose: "#bf3a52",
  };
  return map[color] ?? "#a9842f";
}
