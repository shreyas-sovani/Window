import { describe, expect, it } from "vitest";
import type { LiveWindow } from "../exchange/port";
import { pickWindow } from "./pick-window";

const w = (over: Partial<LiveWindow>): LiveWindow => ({
  marketId: "0x1",
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  venueId: "0xabc",
  pool: "0x0000000000000000000000000000000000000001",
  status: 1,
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
  ...over,
});

describe("pickWindow", () => {
  it("picks the soonest callable Window for the series", () => {
    const got = pickWindow(
      [
        w({ marketId: "0x2", expiry: 3_000 }),
        w({ marketId: "0x3", expiry: 2_200 }),
        w({ asset: "ETH", marketId: "0x4" }),
      ],
      "BTC",
      900,
      1_000,
    );
    expect(got?.marketId).toBe("0x3");
  });

  it("picks a 15m Window even when a shorter series exists on another venue", () => {
    const got = pickWindow(
      [
        w({ intervalSec: 60, venueId: "0xshort", marketId: "0xb", expiry: 1_200 }),
        w({ intervalSec: 900, venueId: "0xlong", marketId: "0xc", expiry: 2_000 }),
      ],
      "BTC",
      900,
      1_000,
    );
    expect(got?.marketId).toBe("0xc");
  });

  it("ignores other venues when a venue is pinned", () => {
    const got = pickWindow(
      [w({ venueId: "0xother", marketId: "0x9" }), w({ marketId: "0xa" })],
      "BTC",
      900,
      1_000,
      "0xabc",
    );
    expect(got?.marketId).toBe("0xa");
  });

  it("treats a 3598s indexer window as the 1h series", () => {
    const got = pickWindow(
      [w({ asset: "ETH", intervalSec: 3598, marketId: "0x1h", expiry: 5_000 })],
      "ETH",
      3600,
      1_000,
    );
    expect(got?.marketId).toBe("0x1h");
  });

  it("still picks a Trading Window inside lock headroom so the board does not go blank", () => {
    const got = pickWindow(
      [w({ marketId: "0xlock", expiry: 2_000 })],
      "BTC",
      900,
      1_950,
    );
    expect(got?.marketId).toBe("0xlock");
  });

  it("prefers a still-open successor over an already-expired row", () => {
    const got = pickWindow(
      [w({ marketId: "0xold", expiry: 1_000 }), w({ marketId: "0xnew", expiry: 2_000 })],
      "BTC",
      900,
      1_100,
    );
    expect(got?.marketId).toBe("0xnew");
  });

  it("falls back to a just-expired Locked Window when no successor is listed yet", () => {
    const got = pickWindow(
      [w({ marketId: "0xwait", expiry: 2_000, status: 2 })],
      "BTC",
      900,
      2_030,
    );
    expect(got?.marketId).toBe("0xwait");
  });

  it("does not keep a Locked Window from a previous interval after the successor is gone too long", () => {
    const got = pickWindow(
      [w({ marketId: "0xstale", expiry: 1_000, status: 2 })],
      "BTC",
      900,
      2_000,
    );
    expect(got).toBeNull();
  });
});
