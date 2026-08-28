const fmtCache = new Map<number, Intl.NumberFormat>();

export function fmt(n: number | undefined, d = 2) {
  if (n === undefined || Number.isNaN(n)) return "—";
  let f = fmtCache.get(d);
  if (!f) {
    f = new Intl.NumberFormat(undefined, { maximumFractionDigits: d });
    fmtCache.set(d, f);
  }
  return f.format(n);
}

export function countdown(expiry: number, now: number) {
  const s = Math.max(0, Math.floor(expiry - now));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function historyLabel(result: string) {
  if (result === "up") return "Up";
  if (result === "down") return "Down";
  if (result === "void") return "Void";
  return "?";
}
