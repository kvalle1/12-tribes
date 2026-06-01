---
status: accepted (supersedes ADR-0002)
---

# Accounts required: backend-and-auth-first architecture

Every Subject has an account and must sign in before taking the assessment. Because authentication needs a backend (server routes + session storage), this supersedes the client-side-first phasing of ADR-0002: the foundational work is now the backend (serverless Postgres + Drizzle on Vercel) and auth, followed by the login-gated assessment, the profile, and finally the 360 layer. The pure scoring core (ADR-0001) is unaffected and is still reused verbatim.

An account holds a **single current result**: retaking the assessment overwrites the previous result rather than accumulating history. The profile, reachable from the home page when signed in, shows that current result. We chose login-up-front (over an anonymous "try it then claim" funnel) at the product owner's direction, accepting the loss of the zero-commitment first run in exchange for every result being durably tied to an identity. We chose a single current result over history to keep the schema simple, accepting that change-over-time tracking is not supported.
