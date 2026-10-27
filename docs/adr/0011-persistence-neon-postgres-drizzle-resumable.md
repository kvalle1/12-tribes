# Persistence: Neon Postgres via Drizzle, resumable Sessions

The Interview persists to **Neon Postgres** through **Drizzle ORM** — the same
datastore the broader product (Self/360 results, accounts, report) uses, rather
than introducing its own. The Session is written **every Turn** so a refresh or
closed tab resumes where the participant left off; the final Strength Profile +
Posture + score trace are retained for the report.

This is the app's first datastore and first server dependency — until now it was
fully static. We chose per-Turn persistence (resumable v1) over an ephemeral
in-memory session because a 15–25 Turn, multi-minute interview that loses
everything on a refresh would frustrate participants, and the Turns are already
server round-trips, so the cost is one write per Turn.

## Consequences

- Schema must store enough to reconstruct a Session mid-flight (running profile,
  Posture tallies, Turn history, counts), not just the final result.
- Reuse the product's Drizzle schema/migrations setup; do not stand up a parallel
  data layer for the Interview.
- Participant identity for resume/report ties to the broader product's
  account/email model — a dependency this feature consumes, not defines.
