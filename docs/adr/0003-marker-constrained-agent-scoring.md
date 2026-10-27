# Marker-constrained agent scoring

The Interview is agent-driven for *question selection* (adaptive, broad→specific)
but constrained for *scoring*: every strength delta the agent assigns must cite a
**Marker** from the Marker Catalog — a concrete signal distilled from the tribe
profiles (strengths / oil / shadow / fall-line in `tribes.ts`) — with a bounded
weight. The agent may not invent ad-hoc scoring rationale.

We chose this hybrid over pure agent judgment (flexible but irreproducible — the
same answer scores differently run-to-run and reasoning can drift) and over a
fully pre-authored question bank with fixed answer weights (reproducible but unable
to adapt surgically, which defeats the point of using an agent).

## Consequences

- Authoring the Marker Catalog — distilling each tribe's prose into discrete,
  scorable, weighted signals — is the major up-front work, analogous to the
  73-word mapping table. The instrument's rigor lives here, not in the prompt.
- Scores are traceable: a participant or skeptic can see *which answer* mapped to
  *which marker* produced *which delta*. This traceability is the main thing that
  makes the Interview more defensible than the word-selection instrument.
- The agent's freedom is asymmetric by design: free to ask anything, constrained
  in what it may score.
