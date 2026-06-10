# Stop Condition: relative margin, stability, and co-Primaries

The Interview ends when all hold: a minimum question count (floor), the Primary's
margin over the highest non-Contender above threshold, and a stable top ordering
over recent answers — with a hard maximum question count as backstop. The
Contender band is the Primary plus every tribe within a margin of it at stop time
(dynamic: zero to several).

Two non-obvious choices:

## Margin is relative to evidence, not absolute

The margin threshold scales with how much total evidence has accumulated, rather
than being a fixed point gap. A large-but-thin early lead (a couple of strong
answers) does not satisfy it. This prevents a confident-sounding but evidence-poor
early result — itself a bias trap.

## Non-convergence yields co-Primaries, not a forced winner

When the maximum is reached and two or three tribes remain inseparable, all are
reported as Primary. We rejected forcing a single Primary by a razor-thin margin:
it manufactures certainty the data doesn't support and would undercut the
credibility that marker-traceability and the Posture axis are buying us. Some
people genuinely are two-tribe; the instrument's value is honesty about a person,
so the Stop Condition honors that.

## Consequences

- Downstream code (report, aggregation) must handle a Primary *set*, not a single
  tribe.
