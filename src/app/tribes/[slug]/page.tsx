import { notFound } from "next/navigation";
import Link from "next/link";
import { getTribeBySlug, tribes, statusLabels } from "@/lib/tribes";

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

const accentBg: Record<string, string> = {
  amber: "bg-amber-950/40 border-amber-800",
  violet: "bg-violet-950/40 border-violet-800",
  blue: "bg-blue-950/40 border-blue-800",
  emerald: "bg-emerald-950/40 border-emerald-800",
  orange: "bg-orange-950/40 border-orange-800",
  red: "bg-red-950/40 border-red-800",
  slate: "bg-slate-800/40 border-slate-600",
  cyan: "bg-cyan-950/40 border-cyan-800",
  lime: "bg-lime-950/40 border-lime-800",
  zinc: "bg-zinc-800/40 border-zinc-600",
  yellow: "bg-yellow-950/40 border-yellow-800",
  rose: "bg-rose-950/40 border-rose-800",
};

const statusBanner: Record<string, string> = {
  disqualified: "bg-red-950/60 border border-red-800 text-red-300",
  warning: "bg-yellow-950/60 border border-yellow-800 text-yellow-300",
  "disqualified-arc": "bg-orange-950/60 border border-orange-800 text-orange-300",
};

const statusNote: Record<string, string> = {
  disqualified:
    "This tribe is absent from Revelation 7's 144,000. Disqualified is not permanent rejection — it is a severe warning. Restoration is available (see Ezekiel 48), but the pattern must be named.",
  warning:
    "This is a warning tribe. Don't stay stuck here. Their fruit warns those around them. The goal is movement into others.",
  "disqualified-arc":
    "This tribe appears in Revelation 7's 144,000, but carries a significant historical disqualification arc. The pattern of first-into-captivity, idolatry, and no recovery narrative is a severe warning.",
};

export async function generateStaticParams() {
  return tribes.map((t) => ({ slug: t.slug }));
}

export default async function TribePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tribe = getTribeBySlug(slug);
  if (!tribe) notFound();

  const accent = accentText[tribe.color];
  const bg = accentBg[tribe.color];

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Back */}
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors mb-10 inline-block"
        >
          ← All Tribes
        </Link>

        {/* Status banner */}
        {tribe.status !== "active" && (
          <div
            className={`rounded-lg px-4 py-3 mb-8 text-sm ${statusBanner[tribe.status]}`}
          >
            <span className="font-semibold uppercase tracking-wider text-xs">
              {statusLabels[tribe.status]}
            </span>
            <p className="mt-1 leading-relaxed opacity-90">
              {statusNote[tribe.status]}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <span className="text-xs text-zinc-600 font-mono">
            {String(tribe.number).padStart(2, "0")} / 12
          </span>
          <h1 className={`text-5xl font-bold mt-1 mb-1 ${accent}`}>
            {tribe.name}
          </h1>
          <p className="text-zinc-400 text-xl font-medium">{tribe.callSign}</p>
          {tribe.hasZeal && (
            <p className="mt-2 text-[11px] uppercase tracking-widest text-zinc-600">
              Marked with Zeal
            </p>
          )}
        </div>

        {/* Key Scripture */}
        <div className={`rounded-xl border p-5 mb-10 ${bg}`}>
          <p className="text-zinc-200 text-base italic leading-relaxed">
            &ldquo;{tribe.keyScripture}&rdquo;
          </p>
          <p className="text-zinc-500 text-xs mt-2">— {tribe.keyScriptureRef}</p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          <Section title="Strengths" content={tribe.strengths} />
          <Section title="Shadow / Constraints" content={tribe.shadowConstraints} />

          {/* Oil */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              Lubricant / Oil
            </h2>
            <p className="text-zinc-200 leading-relaxed">{tribe.oil}</p>
            {tribe.oilScripture && (
              <blockquote className="mt-4 border-l-2 border-zinc-700 pl-4 text-zinc-400 italic text-sm">
                &ldquo;{tribe.oilScripture}&rdquo;
                {tribe.oilScriptureRef && (
                  <span className="block text-zinc-600 not-italic text-xs mt-1">
                    — {tribe.oilScriptureRef}
                  </span>
                )}
              </blockquote>
            )}
          </div>

          <Section title="Fall Line" content={tribe.fallLine} />

          {/* Notable People */}
          <div>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">
              Notable People
            </h2>
            <div className="space-y-4">
              {tribe.notablePeople.map((person) => (
                <div
                  key={person.name}
                  className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-semibold text-zinc-100">
                      {person.name}
                    </h3>
                    <span className="text-xs text-zinc-600 ml-4 shrink-0">
                      {person.reference}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {person.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* The Note */}
          <div className={`rounded-xl border p-5 ${bg}`}>
            <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
              The Note
            </h2>
            <p className="text-zinc-200 leading-relaxed">{tribe.theNote}</p>
          </div>
        </div>

        {/* Prev / Next navigation */}
        <div className="mt-16 flex justify-between text-sm">
          {tribe.number > 1 ? (
            <Link
              href={`/tribes/${tribes[tribe.number - 2].slug}`}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              ← {tribes[tribe.number - 2].name}
            </Link>
          ) : (
            <span />
          )}
          {tribe.number < 12 ? (
            <Link
              href={`/tribes/${tribes[tribe.number].slug}`}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {tribes[tribe.number].name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
        {title}
      </h2>
      <p className="text-zinc-200 leading-relaxed">{content}</p>
    </div>
  );
}
