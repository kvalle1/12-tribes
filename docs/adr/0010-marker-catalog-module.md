# Marker Catalog: server-only module, hand-distilled, even coverage

The Marker Catalog lives in a dedicated **server-only** module (e.g.
`src/lib/interview/markers.ts`) keyed by tribe `slug`, separate from `tribes.ts`.
Each Marker carries: `id` (stable, citable in the score trace), `tribeSlug`
(validated against `tribes.ts`), `type` (`strength`|`oil`|`shadow`|`fallLine`),
`signal` (the observable thing in plain language), `weight` (bounded; shadow/
fall-line may weight higher), and optional `exemplar`/`counterExemplar` snippets to
anchor the agent and curb the conceptual-vs-lived false positive.

Kept separate from `tribes.ts` because that file is the render source of truth
(consumed by static pages, strict ordering invariant); the catalog is a scoring
concern with different churn and a server-only trust boundary. Rejected extending
`tribes.ts` (ships scoring data to the client, entangles change rates) and a loose
external JSON/MDX file (loses type safety and slug validation, no non-engineer
authoring need).

## Two notable choices

- **Hand-distilled, not Claude-generated.** This is where the instrument's rigor
  lives, so the first pass is authored by hand from each tribe's prose. (Claude-
  drafted-then-reviewed was considered for speed and may help later.)
- **Even coverage, deliberately breaking the word-list precedent.** The 73-word
  list is uneven (Dan/Issachar ~10, Naphtali/Simeon ~6). Uneven coverage is itself
  a scoring bias — a tribe with fewer Markers is harder to surface — so every tribe
  gets a comparable number of Markers. A future reader should not "normalize" the
  catalog to the word list's proportions.
