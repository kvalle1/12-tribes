# Phased assessment architecture: client-side self, server-backed 360

> **Status: superseded by ADR-0004.** Requiring accounts with login up front means the assessment needs auth + a backend from the first screen, so the client-side-first phasing below no longer holds. The pure scoring core (ADR-0001) survives; the phasing does not.

The assessment ships in two phases. **Phase 1 (self-assessment)** runs fully client-side on the existing static build — word selection, scoring, and results all in the browser — with the scoring logic kept as a pure, serializable library function and no backend or database. **Phase 2 (360 observer)** wraps persistence and API around that same scoring core: a serverless Postgres database (Neon / Vercel Postgres) accessed via Drizzle ORM, exposed through Next route handlers, deployed on Vercel.

We chose this split so phase 1 ships with zero infrastructure and the scoring core is never reworked — phase 2 is purely additive. We chose relational Postgres over KV because the data is a clean one-to-many (one `subject` self-submission to many `observer_responses`) that benefits from queryable aggregation, and Drizzle because it is TS-native and lightweight. A future reader will see a static, persistence-free self flow and should understand the backend was deliberately deferred, not forgotten.
