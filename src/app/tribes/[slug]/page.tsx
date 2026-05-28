import { notFound } from "next/navigation";
import Link from "next/link";
import { getTribeBySlug, tribes, statusLabels } from "@/lib/tribes";

const accentHex: Record<string, string> = {
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

const statusNote: Record<string, string> = {
  disqualified:
    "This tribe is absent from Revelation 7's 144,000. Disqualified is not permanent rejection — it is a severe warning. Restoration is available (see Ezekiel 48), but the pattern must be named.",
  warning:
    "This is a warning tribe. Don't stay stuck here. Their fruit warns those around them. The goal is movement into others.",
  "disqualified-arc":
    "This tribe appears in Revelation 7's 144,000, but carries a significant historical disqualification arc. The pattern of first-into-captivity, idolatry, and no recovery narrative is a severe warning.",
};

export function generateStaticParams() {
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

  const accent = accentHex[tribe.color] ?? "#a9842f";
  const prev = tribe.number > 1 ? tribes[tribe.number - 2] : null;
  const next = tribe.number < 12 ? tribes[tribe.number] : null;

  return (
    <main
      className="min-h-screen bg-bone text-ink"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Back */}
        <Link
          href="/"
          className="mb-10 inline-block text-sm text-muted transition-colors hover:text-ink"
        >
          ← All Tribes
        </Link>

        {/* Header */}
        <div className="relative mb-10">
          <span className="font-sans text-xs tracking-[0.18em] text-faint">
            {String(tribe.number).padStart(2, "0")} / 12
          </span>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1
                className="font-serif text-6xl font-semibold leading-none"
                style={{ color: accent }}
              >
                {tribe.name}
              </h1>
              <p className="mt-1 font-serif text-xl italic text-muted">
                {tribe.callSign}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.13em] text-faint">
                {tribe.essence}
              </p>
            </div>
            <span
              className="font-hebrew text-6xl font-medium leading-none"
              style={{ color: accent }}
            >
              {tribe.hebrew}
            </span>
          </div>
          {tribe.hasZeal && (
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-gold">
              Marked with Zeal
            </p>
          )}
        </div>

        {/* Key Scripture */}
        <div
          className="mb-10 rounded-xl border bg-white/60 p-5"
          style={{ borderColor: "var(--hair)" }}
        >
          <p className="font-serif text-lg italic leading-relaxed text-ink">
            &ldquo;{tribe.keyScripture}&rdquo;
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.08em] text-faint">
            {tribe.keyScriptureRef}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          <Section title="Strengths" content={tribe.strengths} />
          <Section title="Shadow / Constraints" content={tribe.shadowConstraints} />

          {/* Oil */}
          <div>
            <SectionHeading>Lubricant / Oil</SectionHeading>
            <p className="leading-relaxed text-ink/90">{tribe.oil}</p>
            {tribe.oilScripture && (
              <blockquote
                className="mt-4 border-l-2 pl-4 font-serif text-base italic text-muted"
                style={{ borderColor: accent }}
              >
                &ldquo;{tribe.oilScripture}&rdquo;
                {tribe.oilScriptureRef && (
                  <span className="mt-1 block font-sans text-xs not-italic uppercase tracking-[0.08em] text-faint">
                    {tribe.oilScriptureRef}
                  </span>
                )}
              </blockquote>
            )}
          </div>

          <Section title="Fall Line" content={tribe.fallLine} />

          {/* Status — the in-depth note */}
          {tribe.status !== "active" && (
            <div>
              <SectionHeading>{statusLabels[tribe.status]}</SectionHeading>
              <p className="leading-relaxed text-ink/90">{statusNote[tribe.status]}</p>
            </div>
          )}

          {/* Notable People */}
          <div>
            <SectionHeading>Notable People</SectionHeading>
            <div className="space-y-4">
              {tribe.notablePeople.map((person) => (
                <div
                  key={person.name}
                  className="rounded-lg border bg-white/50 p-4"
                  style={{ borderColor: "var(--hair)" }}
                >
                  <div className="mb-1 flex items-baseline justify-between">
                    <h3 className="font-serif text-lg font-semibold text-ink">
                      {person.name}
                    </h3>
                    <span className="ml-4 shrink-0 text-xs text-faint">
                      {person.reference}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">
                    {person.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* The Note */}
          <div
            className="rounded-xl border bg-white/60 p-5"
            style={{ borderColor: "var(--hair)" }}
          >
            <SectionHeading>The Note</SectionHeading>
            <p className="leading-relaxed text-ink/90">{tribe.theNote}</p>
          </div>
        </div>

        {/* Prev / Next navigation */}
        <div className="mt-16 flex justify-between border-t border-hair pt-8 text-sm">
          {prev ? (
            <Link href={`/tribes/${prev.slug}`} className="text-muted transition-colors hover:text-ink">
              ← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/tribes/${next.slug}`} className="text-muted transition-colors hover:text-ink">
              {next.name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      </div>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-gold">{children}</h2>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <SectionHeading>{title}</SectionHeading>
      <p className="leading-relaxed text-ink/90">{content}</p>
    </div>
  );
}
