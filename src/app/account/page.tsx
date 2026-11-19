import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentResult } from "@/lib/assessment/repository";
import { getObserverResponses } from "@/lib/observer/repository";
import { currentSession } from "@/lib/interview/session";
import {
  buildAccountOverview,
  type AccountOverview,
} from "@/lib/account/overview";
import { accentHex, tribes, type Tribe } from "@/lib/tribes";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * The Participant's home base. One page that answers three questions:
 *  1. Where am I? — the three instruments (Self, 360, Interview) as a path,
 *     with one clearly highlighted next step.
 *  2. What did I learn? — a way back to every completed result.
 *  3. What now? — learning content for the tribes they actually express.
 *
 * All decisions live in the pure `buildAccountOverview`; this file only loads
 * data and renders. Unauthenticated visitors are sent through sign-in.
 */
export default async function AccountPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/signin?callbackUrl=%2Faccount");

  const assessment = await getCurrentResult(userId);
  const [observers, interviewSession] = await Promise.all([
    assessment
      ? getObserverResponses(userId, assessment.updatedAt)
      : Promise.resolve({ current: [] as unknown[], staleCount: 0 }),
    currentSession(),
  ]);

  const overview = buildAccountOverview({
    name: session.user?.name,
    email: session.user?.email,
    assessment,
    observerCount: observers.current.length,
    interview: interviewSession
      ? { status: interviewSession.status, turnCount: interviewSession.turnCount }
      : null,
  });

  const primary = overview.strengthTribes[0];
  const accent = primary ? accentHex(primary.color) : "var(--gold)";

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[880px] px-8 py-[88px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        {/* Hero */}
        <header className="mt-10" style={{ "--accent": accent } as React.CSSProperties}>
          <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
            Welcome back
          </p>
          <h1 className="mt-2 font-serif text-[clamp(36px,6vw,56px)] font-semibold leading-[1.04]">
            {overview.displayName}
          </h1>
          {primary ? (
            <p className="mt-2 font-serif text-[22px] italic text-muted">
              Wired as{" "}
              <span className="not-italic" style={{ color: "var(--accent)" }}>
                {primary.name}
              </span>
              , {primary.callSign.toLowerCase()}
              {overview.strengthTribes[1] && (
                <> — with {overview.strengthTribes[1].name} close behind</>
              )}
            </p>
          ) : (
            <p className="mt-2 max-w-[520px] font-serif text-[20px] italic text-muted">
              Twelve tribes, three ways of seeing yourself. Start with the first.
            </p>
          )}

          <JourneyProgress overview={overview} />
        </header>

        {/* Next step */}
        <Link
          href={overview.nextStep.href}
          className="group mt-10 flex items-center justify-between gap-6 rounded-[2px] bg-ink px-7 py-6 text-bone transition-colors hover:bg-black"
        >
          <span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-bone/60">
              Your next step
            </span>
            <span className="mt-1 block font-serif text-[24px] leading-tight">
              {overview.nextStep.label}
            </span>
          </span>
          <span aria-hidden className="text-[22px] transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>

        {/* Instruments */}
        <section className="mt-16" aria-labelledby="instruments">
          <SectionLabel id="instruments">Your assessments</SectionLabel>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <SelfCard overview={overview} takenAt={assessment?.updatedAt} />
            <ObserverCard overview={overview} staleCount={observers.staleCount} />
            <InterviewCard overview={overview} />
          </div>
        </section>

        {/* Learning */}
        <section className="mt-16" aria-labelledby="learn">
          <SectionLabel id="learn">Dive into your strengths</SectionLabel>
          {overview.strengthTribes.length > 0 ? (
            <div className="mt-5 flex flex-col gap-5">
              {overview.strengthTribes.map((tribe, i) => (
                <StrengthLesson key={tribe.slug} tribe={tribe} role={i === 0 ? "Primary" : "Secondary"} />
              ))}
            </div>
          ) : (
            <p className="mt-5 max-w-[520px] rounded-[2px] border border-dashed border-hair p-6 text-[15px] text-muted">
              Complete the Self Assessment and this space fills with study material
              for the tribes you express most — your strengths, what brings them
              alive, the figures who carried them, and the scripture behind them.
            </p>
          )}

          <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
            Explore the other tribes
          </p>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {tribes.map((tribe) => (
              <li key={tribe.slug}>
                <Link
                  href={`/tribes/${tribe.slug}`}
                  className="flex items-center gap-2 rounded-full border border-hair px-3.5 py-1.5 text-[14px] transition-colors hover:border-ink"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accentHex(tribe.color) }}
                  />
                  {tribe.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Account */}
        <section className="mt-16 border-t border-hair pt-8" aria-labelledby="acct">
          <SectionLabel id="acct">Account</SectionLabel>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
            <p className="font-serif text-[18px]">
              Signed in as <span className="text-gold">{session.user?.email}</span>
            </p>
            <SignOutButton />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-[12px] uppercase tracking-[0.2em] text-faint">
      {children}
    </h2>
  );
}

/** Three-step path: filled dot = complete. */
function JourneyProgress({ overview }: { overview: AccountOverview }) {
  const steps = [
    { label: "Self", done: overview.self.status === "complete" },
    { label: "360", done: overview.observers.status === "ready" },
    { label: "Interview", done: overview.interview.status === "complete" },
  ];
  return (
    <div
      className="mt-6 flex items-center gap-3"
      role="img"
      aria-label={`${overview.completedCount} of 3 assessments complete`}
    >
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-muted">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full border"
              style={{
                borderColor: "var(--accent)",
                backgroundColor: s.done ? "var(--accent)" : "transparent",
              }}
            />
            {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden className="h-px w-8 bg-hair" />}
        </div>
      ))}
    </div>
  );
}

function Card({
  eyebrow,
  title,
  status,
  children,
}: {
  eyebrow: string;
  title: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-[2px] border border-hair p-5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-faint">
        <span>{eyebrow}</span>
        <span>{status}</span>
      </div>
      <h3 className="mt-3 font-serif text-[22px] font-semibold leading-snug">{title}</h3>
      <div className="mt-2 flex flex-1 flex-col text-[14px] text-muted">{children}</div>
    </div>
  );
}

function CardLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "mt-5 self-start rounded-[2px] bg-ink px-5 py-2.5 text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          : "mt-5 self-start border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      }
    >
      {children}
    </Link>
  );
}

function SelfCard({ overview, takenAt }: { overview: AccountOverview; takenAt?: Date }) {
  if (overview.self.status === "not-started") {
    return (
      <Card eyebrow="Self" title="Self Assessment" status="Not taken">
        <p>Pick the words that genuinely describe you. About five minutes.</p>
        <CardLink href="/assessment" primary>Take it now</CardLink>
      </Card>
    );
  }
  return (
    <Card eyebrow="Self" title="Self Assessment" status="Complete">
      <p>
        Your result, ranking of all twelve tribes, and the words you chose.
        {takenAt && <> Taken {formatDate(takenAt)}.</>}
      </p>
      <div className="flex flex-wrap gap-x-5">
        <CardLink href="/assessment/result" primary>Review result</CardLink>
        <CardLink href="/assessment">Retake</CardLink>
      </div>
    </Card>
  );
}

function ObserverCard({ overview, staleCount }: { overview: AccountOverview; staleCount: number }) {
  const o = overview.observers;
  if (o.status === "locked") {
    return (
      <Card eyebrow="360" title="How others see you" status="Locked">
        <p>Finish your Self Assessment first, then invite {o.needed} or more people to describe you anonymously.</p>
      </Card>
    );
  }
  return (
    <Card eyebrow="360" title="How others see you" status={o.status === "ready" ? "Ready" : "Collecting"}>
      <div
        className="mt-1 flex gap-1.5"
        role="img"
        aria-label={`${o.count} of ${o.needed} responses`}
      >
        {Array.from({ length: o.needed }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i < o.count ? "var(--gold)" : "var(--hair)" }}
          />
        ))}
      </div>
      <p className="mt-3">
        {o.status === "ready"
          ? `${o.count} responses in — your comparison is unlocked.`
          : `${o.count} of ${o.needed} responses. ${o.remaining} more unlocks the comparison.`}
      </p>
      {staleCount > 0 && (
        <p className="mt-1 text-[12px] text-faint">
          {staleCount} earlier {staleCount === 1 ? "response predates" : "responses predate"} your retake.
        </p>
      )}
      <CardLink href={o.status === "ready" ? "/assessment/result#compare" : "/assessment/result#share"} primary={o.status !== "ready"}>
        {o.status === "ready" ? "See the comparison" : "Get your invite link"}
      </CardLink>
    </Card>
  );
}

function InterviewCard({ overview }: { overview: AccountOverview }) {
  const i = overview.interview;
  const copy = {
    "not-started": ["Not started", "A conversation that isolates your strengths — it never sees your other results.", "Start the interview", true],
    "in-progress": ["In progress", `You've answered ${i.turnCount} so far. Pick up where you left off.`, "Continue", true],
    complete: ["Complete", `Finished after ${i.turnCount} answers.`, "View result", false],
  } as const;
  const [status, body, cta, primary] = copy[i.status];
  return (
    <Card eyebrow="Interview" title="The Interview" status={status}>
      <p>{body}</p>
      <CardLink href={i.status === "complete" ? "/interview/result" : "/interview"} primary={primary}>
        {cta}
      </CardLink>
    </Card>
  );
}

/** A compact study card for one of the Participant's strength tribes. */
function StrengthLesson({ tribe, role }: { tribe: Tribe; role: string }) {
  const accent = accentHex(tribe.color);
  const people = tribe.notablePeople.slice(0, 3);
  return (
    <article
      className="rounded-[2px] border border-hair border-l-[3px] p-6"
      style={{ borderLeftColor: accent }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-[28px] font-semibold leading-none" style={{ color: accent }}>
          {tribe.name}
          <span className="ml-3 font-serif text-[16px] font-normal italic text-muted">
            {tribe.callSign}
          </span>
        </h3>
        <span className="text-[11px] uppercase tracking-[0.16em] text-faint">{role}</span>
      </div>

      <blockquote className="mt-4 font-serif text-[18px] italic leading-snug text-ink">
        “{tribe.keyScripture}”
        <footer className="mt-1 text-[12px] not-italic uppercase tracking-[0.14em] text-faint">
          {tribe.keyScriptureRef}
        </footer>
      </blockquote>

      <dl className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-faint">Your strengths</dt>
          <dd className="mt-1.5 text-[14px] leading-[1.6] text-muted">{tribe.strengths}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-faint">What brings you alive</dt>
          <dd className="mt-1.5 text-[14px] leading-[1.6] text-muted">{tribe.oil}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-faint">Study these lives</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {people.map((p) => (
            <li
              key={p.name}
              className="rounded-[2px] bg-stone px-3 py-1 text-[13px]"
              title={p.description}
            >
              {p.name} <span className="text-faint">· {p.reference}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href={`/tribes/${tribe.slug}`}
        className="mt-6 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Read the full {tribe.name} profile →
      </Link>
    </article>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
