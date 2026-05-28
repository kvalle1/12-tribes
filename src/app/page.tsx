import Link from "next/link";
import { tribes, statusLabels, type TribeStatus } from "@/lib/tribes";

const statusBadge: Record<TribeStatus, string> = {
  active: "",
  disqualified: "bg-red-900/60 text-red-300 border border-red-700",
  warning: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
  "disqualified-arc": "bg-orange-900/60 text-orange-300 border border-orange-700",
};

const accentBorder: Record<string, string> = {
  amber: "border-amber-600 hover:border-amber-400",
  violet: "border-violet-600 hover:border-violet-400",
  blue: "border-blue-600 hover:border-blue-400",
  emerald: "border-emerald-600 hover:border-emerald-400",
  orange: "border-orange-600 hover:border-orange-400",
  red: "border-red-600 hover:border-red-400",
  slate: "border-slate-500 hover:border-slate-300",
  cyan: "border-cyan-600 hover:border-cyan-400",
  lime: "border-lime-600 hover:border-lime-400",
  zinc: "border-zinc-500 hover:border-zinc-300",
  yellow: "border-yellow-600 hover:border-yellow-400",
  rose: "border-rose-600 hover:border-rose-400",
};

const accentText: Record<string, string> = {
  amber: "text-amber-400",
  violet: "text-violet-400",
  blue: "text-blue-400",
  emerald: "text-emerald-400",
  orange: "text-orange-400",
  red: "text-red-400",
  slate: "text-slate-300",
  cyan: "text-cyan-400",
  lime: "text-lime-400",
  zinc: "text-zinc-300",
  yellow: "text-yellow-400",
  rose: "text-rose-400",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">
            Personality &amp; Leadership Framework
          </p>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Tribe Index
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Twelve archetypes. Ancient source material. Strengths, shadow, oil,
            and fall line — mapped to how people are actually wired.
          </p>
        </div>

        {/* Tribe Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tribes.map((tribe) => (
            <Link
              key={tribe.slug}
              href={`/tribes/${tribe.slug}`}
              className={`group relative rounded-xl border-2 bg-white/[0.03] p-6 transition-all duration-200 hover:bg-white/[0.06] ${accentBorder[tribe.color]}`}
            >
              {/* Tribe number */}
              <span className="text-xs text-zinc-600 font-mono">
                {String(tribe.number).padStart(2, "0")}
              </span>

              {/* Status badge */}
              {tribe.status !== "active" && (
                <span
                  className={`absolute top-4 right-4 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-medium ${statusBadge[tribe.status]}`}
                >
                  {statusLabels[tribe.status]}
                </span>
              )}

              {/* Name + Call Sign */}
              <h2
                className={`mt-2 text-2xl font-bold ${accentText[tribe.color]}`}
              >
                {tribe.name}
              </h2>
              <p className="text-zinc-400 text-sm font-medium tracking-wide mb-4">
                {tribe.callSign}
              </p>

              {/* Scripture teaser */}
              <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">
                &ldquo;{tribe.keyScripture}&rdquo;
              </p>

              {/* Zeal marker */}
              {tribe.hasZeal && (
                <p className="mt-3 text-[10px] uppercase tracking-widest text-zinc-600">
                  Marked with Zeal
                </p>
              )}

              {/* Arrow */}
              <span className="absolute bottom-5 right-5 text-zinc-700 group-hover:text-zinc-400 transition-colors text-lg">
                →
              </span>
            </Link>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-12 flex flex-wrap gap-4 justify-center text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-700" />
            Disqualified — absent from Revelation 7
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-700" />
            Disqualified Arc — present in Rev 7, significant warning
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-700" />
            Warning Tribe — don&apos;t stay stuck here
          </div>
        </div>
      </div>
    </main>
  );
}
