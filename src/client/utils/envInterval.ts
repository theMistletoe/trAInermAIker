/**
 * Read a millisecond interval from a Vite env var, falling back to `fallback`
 * unless the value is a finite positive number.
 *
 * `??` alone is not enough: Vite inlines an env var defined-but-empty as `''`,
 * and `Number('')` is 0 — a 0ms setInterval turns polling into a request
 * storm. Non-numeric values (`NaN`) degrade the same way.
 */
export function envInterval(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
