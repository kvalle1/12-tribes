/**
 * Deterministic, non-temporal display order for a Subject's Observer responses
 * (issue #9, ADR-0003).
 *
 * The comparison report labels observers anonymously as Observer 1 / 2 / 3. If we
 * ordered them by arrival time, a Subject could infer who "Observer 1" is — the
 * first person they sent the link to who answered — quietly eroding the anonymity
 * the 360 depends on. Instead we order by a stable hash of (subjectId, responseId):
 * the labels carry no signal about when, or in what order, anyone responded, yet
 * stay stable across views. Pure and client-free so it is unit-testable.
 */

/**
 * Return the rows in a stable order determined only by (subjectId, row id) — never
 * by their arrival order or their order in the input array.
 */
export function anonymousOrder<T extends { id: string }>(
  subjectId: string,
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ha = seededHash(`${subjectId}:${a.id}`);
    const hb = seededHash(`${subjectId}:${b.id}`);
    // Fall back to the id itself on a hash tie so the order stays total.
    return ha - hb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/** FNV-1a 32-bit hash — cheap, deterministic, and good enough for ordering. */
function seededHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
