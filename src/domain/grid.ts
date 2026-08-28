/** Snap Event Contract prices and sizes onto the pool grid. */

export function quantizePrice(raw: bigint, tick: bigint): bigint {
  if (tick <= 0n) throw new Error("tick must be positive");
  if (raw <= 0n) return 0n;
  return ((raw + tick / 2n) / tick) * tick;
}

export function quantizeSize(raw: bigint, lot: bigint): bigint {
  if (lot <= 0n) throw new Error("lot must be positive");
  if (raw < lot) return 0n;
  return (raw / lot) * lot;
}
