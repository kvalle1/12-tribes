# Server-authoritative agent loop, Anthropic SDK, single-agent per Turn

The Interview runs as a server-authoritative loop. A route handler / server action
owns the Session (Strength Profile, Posture, history, counts). The client renders
the current Turn and posts the answer back — one Turn per request. Scoring state
and the Marker Catalog are server-side only, never shipped to or mutated by the
client.

Each Turn calls **Claude via the Anthropic SDK using tool-use for structured
output**: one call both interprets/scores the answer (returning validated per-tribe
Marker deltas) and chooses the next Turn (`question` | `dilemma` | `stop`). The
static context (Marker Catalog, tribe profiles, rubric) is sent with **prompt
caching** since it repeats every Turn.

## Considered Options

- **Split scorer/interviewer agents (deferred).** A constrained *scorer* call plus
  a separate *interviewer* call improves separation and testability but doubles
  per-Turn latency and cost. Chosen single-agent for v1; revisit if scoring
  quality demands the split.

## Consequences

- API keys and scoring logic stay server-side; the assessment is not client-
  trustable by construction.
- This is the app's first server runtime and first external dependency — until now
  it was fully static (`generateStaticParams`). Next.js here is 16.2.6 with
  breaking changes: read `node_modules/next/dist/docs/` for current route-handler /
  server-action / streaming conventions before writing code.
- Streaming the question text is a later nicety; the structured scoring payload is
  never streamed.
