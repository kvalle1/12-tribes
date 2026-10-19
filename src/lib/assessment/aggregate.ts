import "server-only";
import { score, type TribeScore } from "./score";

/**
 * Equal-weight "others" aggregation for the 360 comparison report (issue #9,
 * ADR-0003).
 *
 * Each Observer's word selection is scored on its own with the same normalized
 * core the Self flow uses (`score`), and the resulting per-tribe scores are then
 * averaged across Observers with **equal weight** — so an Observer who selects
 * more words carries no more influence than one who selects fewer. This is
 * deliberately *not* a pooled bag of words: pooling every Observer's words into
 * one selection would let word count become influence, which ADR-0003 rejects
 * ("effort should never become influence").
 *
 * `server-only` because `score` pulls in the word→tribe mapping, which must
 * never reach the client (ADR-0009). The returned profile is a `TribeScore[]`
 * in canonical (tribe `number`) order — the same shape the Self flow produces —
 * so it feeds straight into `rankScores` and the shared result rendering.
 */
export function aggregateObservers(
  responses: readonly (readonly string[])[],
): TribeScore[] {
  // Normalize each Observer independently first; this is what makes the later
  // average equal-weight rather than a pooled bag of words.
  const perObserver = responses.map((words) => score(words));

  // No Observers yet → an all-zero profile in canonical order, so a caller can
  // render a well-formed (empty) chart without special-casing the count.
  if (perObserver.length === 0) return score([]);

  const n = perObserver.length;
  // Every `score()` result lists the twelve tribes in the same canonical order,
  // so the tribe at index `i` is the same across all Observers and we can
  // average position by position.
  return perObserver[0].map(({ slug, name }, i) => ({
    slug,
    name,
    score: perObserver.reduce((sum, observer) => sum + observer[i].score, 0) / n,
  }));
}
