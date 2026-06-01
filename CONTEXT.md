# Tribe Index

Tribe Index presents the 12 biblical-tribe archetypes and a word-selection assessment that maps a person to a primary (and sometimes secondary) tribe, with an optional 360 layer comparing how a person sees themselves against how others see them.

## Language

### Archetypes

**Tribe**:
One of the 12 biblical-tribe archetypes (the source of truth is the `tribes` array). Each has a normalized score in an assessment result.
_Avoid_: type, category, profile (a "profile" is the prose write-up, not the archetype itself)

**Primary tribe**:
The single highest-scoring tribe in a result. Always present.

**Secondary tribe**:
A close runner-up tribe, shown only when it scores near the primary and clearly ahead of the third tribe. May be absent — some results name only a primary.

### Assessment

**Self Assessment**:
The flow in which a person selects the words that describe themselves and receives their own result. Runs fully client-side.
_Avoid_: quiz, test, survey

**360 Observer Assessment**:
The flow in which other people select words to describe the subject; their results are aggregated and compared against the subject's self result.
_Avoid_: peer review, feedback (too generic)

**Account**:
An authenticated identity, keyed by email and signed in via a magic link. Holds a single current assessment result. Every Subject has one — sign-in is required before taking the assessment (ADR-0004, ADR-0005).
_Avoid_: user, login, profile (the "profile" is the page that displays an Account's result, not the identity itself)

**Subject**:
The person being assessed — an Account holder who has taken the assessment and may be described by Observers.
_Avoid_: user, participant, candidate

**Observer**:
A person who completes a 360 assessment about the Subject. Always anonymous to the Subject — never named, no relationship label.
_Avoid_: reviewer, rater, respondent

### Scoring

**Word**:
An adjective on the flat selection list. Each Word maps to one or two Tribes. The list is presented unlabeled and in random order.
_Avoid_: trait, attribute, adjective (in code)

**Shared word**:
A Word mapped to two Tribes. Contributes half weight (0.5) to each rather than full weight (1.0) to one.
_Avoid_: split word, dual word

**Tribe score**:
A tribe's normalized result: the points earned for that tribe divided by the total points available for it across the whole word list. Ranges 0–1, comparable across tribes regardless of how many words map to each. See ADR-0001.
_Avoid_: points, total (those are intermediate, pre-normalization)
