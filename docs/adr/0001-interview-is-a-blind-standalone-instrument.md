# Interview is a blind, standalone instrument

The AI-agent Interview runs independently of the Self and 360 Assessments and is
**not** seeded with their results. We chose this over a warm-start design (where
prior scores prime the interview as a Bayesian prior and the agent probes where
self/360 diverge) because the interview's purpose is to be the *least biased*
instrument we have — and knowing the prior results would anchor both the agent's
questioning and the participant's answers toward confirming them.

## Considered Options

- **Warm start (rejected, parked for future).** Seed the interview with the
  Self + 360 scores as a prior; spend questions surgically where the prior is
  uncertain or contested. More efficient and *corrective* rather than merely
  additive — but sacrifices independence and invites confirmation bias. Worth
  revisiting once the blind instrument is validated and we want a faster,
  targeted "tie-breaker" mode.

## Consequences

- The report can show three genuinely independent columns (Self / 360 /
  Interview); divergence between them is real signal, not an artifact of one
  feeding the other.
- The interview cannot rely on prior scores to shorten itself — it must reach
  its confidence threshold from a cold start every time.
