/**
 * An injectable source of time. The ledger core never calls `Date.now()` or
 * `new Date()` directly, so its output is fully deterministic under test — pass a
 * {@link fixedClock} and every `confirmedAt` is reproducible.
 */
export type Clock = () => Date;

/** Wall-clock time. The default for production use. */
export const systemClock: Clock = () => new Date();

/** A clock frozen at a fixed instant, for deterministic tests. */
export function fixedClock(iso: string): Clock {
  const instant = new Date(iso);
  return () => instant;
}
