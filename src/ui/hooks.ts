import { useEffect, useState } from "react";
import { pushSample } from "../domain/chart";
import type { AssetPrice, Sample } from "../exchange/port";

/** Wall-clock seconds, ticking once per second for countdowns and sample stamps. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export type Banner = { kind: "ok" | "err"; text: string; txHash?: string } | null;

/** Action-result banner. Ok banners auto-dismiss; errors persist until the next action. */
export function useBanner(): [Banner, (b: Banner) => void] {
  const [banner, setBanner] = useState<Banner>(null);
  useEffect(() => {
    if (!banner || banner.kind !== "ok") return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);
  return [banner, setBanner];
}

/** Sparkline sample buffers for Pulse, reset when the series changes. */
export function usePulseSamples(input: {
  seriesKey: string;
  implied: number | undefined;
  price: AssetPrice | null | undefined;
  now: number;
}): { impliedSamples: Sample[]; priceSamples: Sample[] } {
  const [impliedSamples, setImpliedSamples] = useState<Sample[]>([]);
  const [priceSamples, setPriceSamples] = useState<Sample[]>([]);
  useEffect(() => {
    setImpliedSamples([]);
    setPriceSamples([]);
  }, [input.seriesKey]);
  useEffect(() => {
    if (input.implied === undefined) return;
    setImpliedSamples((prev) => pushSample(prev, { t: Math.floor(input.now), v: input.implied as number }));
  }, [input.implied, input.now]);
  useEffect(() => {
    const price = input.price;
    if (!price) return;
    setPriceSamples((prev) => pushSample(prev, { t: Math.floor(input.now), v: price.price }));
  }, [input.price, input.now]);
  return { impliedSamples, priceSamples };
}
