/** Mandatory order expiry in nanoseconds (dreamDEX gotcha #5). `0` reverts. */

export function expireTimestampNs(nowSec: number, ttlSec: number, marketExpirySec: number): bigint {
  const capped = Math.min(nowSec + ttlSec, marketExpirySec);
  if (capped <= nowSec) throw new Error("expiry is not in the future");
  return BigInt(capped) * 1_000_000_000n;
}
