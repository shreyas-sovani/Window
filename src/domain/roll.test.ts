import { describe, expect, it } from "vitest";
import { rollPrompt, type LastCall } from "./roll";
import type { LiveWindow } from "../exchange/port";

const win = (over: Partial<LiveWindow> = {}): LiveWindow => ({
  marketId: "0x" + "11".repeat(32),
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  downSymbol: "BTC#NO",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  venueId: "0xvenue",
  pool: "0x0000000000000000000000000000000000000001",
  status: 1,
  openingPrice: "67,000",
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
  ...over,
});

const last: LastCall = {
  asset: "BTC",
  intervalSec: 900,
  side: "up",
  stake: 10,
  marketId: "0x" + "00".repeat(32),
};

describe("rollPrompt (Rematch)", () => {
  it("offers the same Call again on the successor Window of the same series — rematch keeps the side", () => {
    const p = rollPrompt({ last, live: win(), callable: true });
    expect(p).not.toBeNull();
    expect(p!.title).toContain("Rematch");
    expect(p!.title).toContain("BTC 15m");
    expect(p!.action).toContain("Call Up");
    expect(p!.action).toContain("10");
    expect(p!.side).toBe("up");
  });

  it("a rematch on the Down side keeps Down", () => {
    const p = rollPrompt({ last: { ...last, side: "down" }, live: win(), callable: true });
    expect(p!.side).toBe("down");
    expect(p!.action).toContain("Call Down");
  });

  it("stays quiet while the called Window is still the live one — never the dead marketId", () => {
    expect(rollPrompt({ last, live: win({ marketId: last.marketId }), callable: true })).toBeNull();
  });

  it("stays quiet for a different series — a rematch is the same asset and cadence", () => {
    expect(rollPrompt({ last, live: win({ asset: "ETH", marketId: "0xe" }), callable: true })).toBeNull();
    expect(rollPrompt({ last, live: win({ intervalSec: 3600, marketId: "0xh" }), callable: true })).toBeNull();
  });

  it("snaps cadence drift before comparing", () => {
    const p = rollPrompt({ last, live: win({ intervalSec: 898, marketId: "0xd" }), callable: true });
    expect(p).not.toBeNull();
  });

  it("stays quiet when the successor is not callable", () => {
    expect(rollPrompt({ last, live: win({ status: 2 }), callable: false })).toBeNull();
  });

  it("stays quiet after the user dismisses it for this Window", () => {
    const live = win();
    expect(rollPrompt({ last, live, callable: true, dismissedMarketId: live.marketId })).toBeNull();
  });

  it("returns null with nothing remembered", () => {
    expect(rollPrompt({ last: null, live: win(), callable: true })).toBeNull();
  });
});
