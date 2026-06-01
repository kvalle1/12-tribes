# Tribe Index

Tribe Index identifies which of the 12 biblical tribes best matches how a person
is wired — their strengths, shadow, and the conditions under which they thrive or
fall. It does this through multiple independent instruments whose results are
compared against each other.

## Language

**Instrument**:
One independent method of gathering evidence about a person's tribe wiring. The
product has three: the Self Assessment, the 360 Observer Assessment, and the
Interview. Each produces its own result; the report compares them.

**Self Assessment**:
The word-selection instrument completed by the participant about themselves —
they pick adjectives from a flat list that get mapped to tribes.
_Avoid_: quiz, test, survey.

**360 Observer Assessment**:
The same word-selection instrument completed by 3–5 other people about the
participant. Surfaces the gap between how a person sees themselves and how others
experience them.
_Avoid_: peer review, feedback form.

**Interview**:
The AI-agent conversational instrument. Begins broad to find the tribes a person
gravitates toward, then narrows to isolate strengths surgically, producing a
percentage attribution across tribes. Runs **blind** — it does not see Self or
360 results, so its evidence stays independent.
_Avoid_: chat, interrogation, grilling.

**Participant**:
The person being assessed. The subject of all three instruments.
_Avoid_: user, candidate, subject.

**Strength Profile**:
The canonical output shape of every instrument: a score per tribe for how
strongly the person expresses that tribe's wiring. Scores are independent (high
Judah does not lower Levi) and normalized to percentages for display. Because all
three instruments share this shape, their results can be compared and combined.
_Avoid_: ranking, distribution, posterior.

**Attribution**:
The percentage form of a Strength Profile — each tribe's share of the normalized
total. What the participant sees.

**Primary Tribe**:
The highest-strength tribe in a profile.
_Avoid_: dominant tribe, type.

**Contenders**:
The dynamic set of next-highest tribes that fall within a margin of the Primary —
real runners-up, not a fixed count. Replaces the old "secondary tribe."
_Avoid_: secondary tribe, runner-up (singular).

**Confidence**:
How settled the Interview's result is — a function of the margin between the
Primary and the pack and the stability of the ranking over recent answers. The
margin is judged **relative to accumulated evidence**, not as an absolute point
gap, so a large-but-thin early lead does not trigger an early stop. It is **not** a
probability that a tribe is correct, and the Strength Profile is not a probability
distribution. Confidence is what the Stop Condition tests.
_Avoid_: probability, certainty, p-value.

**Stop Condition**:
When the Interview ends. All of: a minimum question count (floor — guarantees
Calibration completes and blocks a 3-question victory), the Primary's margin over
the highest non-Contender holding above threshold, and the top ordering staying
stable over recent answers (information gain has flattened) — backstopped by a hard
maximum question count.

**Co-Primary**:
The honest result when the maximum is reached and two or three tribes remain
statistically inseparable: they are all reported as Primary. The Interview never
manufactures a single winner by a razor-thin margin.
_Avoid_: tie, draw, blend (in scoring; "blend" is fine in participant-facing copy).

**Tribe Status**:
The `status` field in `tribes.ts` (`active` / `disqualified` / `warning` /
`disqualified-arc`) describes a tribe's *narrative arc*, not whether its wiring
exists in people. Scoring is **status-blind** — all 12 tribes are eligible as
Primary. Status affects only interpretation and report framing, where it couples
to Posture (a disqualified-tribe Primary in active-shadow is the cautionary
reading; integrated is the redemption reading).

**Marker**:
A concrete, observable signal distilled from a tribe's profile that an answer can
be mapped to, carrying a bounded weight toward that tribe's strength. The scorable
unit of the Interview. Every strength delta the agent assigns must cite a Marker —
the agent may not invent ad-hoc rationale.
_Avoid_: signal, trait, indicator, keyword.

**Marker Catalog**:
The full set of Markers across all 12 tribes — the rubric the Interview scores
against. The Q&A equivalent of the Self Assessment's word-to-tribe mapping table,
and where the instrument's rigor lives. Lives in a **server-only** module keyed by
tribe `slug` (separate from the render-focused `tribes.ts`), hand-distilled, with
**even coverage** across all 12 tribes — every tribe gets a comparable number of
Markers so none is harder to surface.

**Marker Type**:
Which field of a tribe's profile a Marker is distilled from: `strength`, `oil`,
`shadow`, or `fallLine`. All four types feed tribe strength — shadow and
fall-line are diagnostic of wiring, not disqualifying, and are the most
bias-resistant signals because people do not fake their weaknesses to look like a
tribe.

**Posture**:
Where a tribe's wiring sits on its fall→oil redemption arc for this participant,
recorded per scored Marker and aggregated per tribe — from *active-shadow*
(captive to the fall-line now) through *integrated* (recognizes the pull, has
matured past it). **Orthogonal to strength**: maturity moves Posture toward
integrated without lowering strength. Mirrors the existing tribe `status`/arc and
lets the report show not just which tribe but where on its arc the person stands.
_Avoid_: maturity score, health, stage.

**Funnel**:
The Interview's broad→specific question-selection strategy, in two phases:
*Calibration* then *Discrimination*.
_Avoid_: flow, script, branching.

**Calibration**:
The fixed broad opening — a few deliberately general "feeler" questions that touch
every tribe's territory at low resolution before the agent commits attention. A
bias safeguard: it gives all 12 tribes a fair look so the first answer can't
railroad the result.

**Discrimination**:
The information-gain phase that follows Calibration. The agent asks whatever best
separates the live **Contenders** — never to confirm the current leader, and
preferentially to demote it or promote a dark horse — using neutral
situation/behavior prompts that let Markers emerge unprompted rather than leading
questions.

**Dilemma**:
A forced-choice turn type the agent can deploy during Discrimination to break a
stubborn tie between Contenders: two concrete situations, **labelled with no
tribe**, that pit the contenders' values against each other. The signal is the
*trade-off the participant makes plus their free-text reasoning* — never the bare
option picked — which keeps it bias-resistant (you can't claim both) without
relapsing into leading or self-flattery. The default turn is free-text prose;
Dilemmas are the targeted exception.

**Turn**:
One question-and-answer exchange — the unit of the Interview loop. One Turn maps
to one server request: the answer comes in, the agent scores it and chooses the
next Turn (or to stop).

**Session**:
The server-authoritative state of one Interview run: the running Strength Profile,
Posture tallies, Turn history, and counts. It lives **server-side only** and is
never shipped to or mutable by the client — otherwise the instrument is gameable.
Persisted to Postgres on every Turn so a refresh or closed tab resumes where the
participant left off; the final result is retained for the report.
