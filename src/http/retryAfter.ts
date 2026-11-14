/** Seconds from a Retry-After header (delta-seconds or an HTTP date); undefined when absent or unusable. */
export function parseRetryAfter(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.ceil(asNumber);
  const when = Date.parse(value);
  return Number.isFinite(when) ? Math.max(0, Math.ceil((when - Date.now()) / 1000)) : undefined;
}
