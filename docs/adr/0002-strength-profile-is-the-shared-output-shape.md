# Strength Profile is the shared output shape

Every instrument (Self, 360, Interview) outputs a **Strength Profile**: an
independent score per tribe, normalized to percentages for display. The Interview
does **not** output a probability distribution over a single "correct" tribe.
Confidence (the Interview's stop condition) is computed separately as the margin
between the Primary and the pack plus the stability of the ranking — it is not
probability mass.

We chose this over a single-primary posterior distribution because (a) the goal is
to surface a Primary *plus a dynamic set of Contenders*, which a winner-take-all
posterior fights against, and (b) a shared per-tribe shape lets all three
instruments be compared and aggregated on one scale without reconciling units.

## Consequences

- A future reader seeing per-tribe strengths instead of a softmax distribution
  should know confidence is deliberately a separate margin/stability measure, not
  derived from the scores summing to 100%.
- Display normalization (shares summing to 100%) is cosmetic; the underlying
  scores are independent and must not be treated as mutually exclusive.
