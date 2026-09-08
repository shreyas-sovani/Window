import { describe, expect, it } from "vitest";
import { demoResultFor, DEMO_EPOCH_SEC, demoWindowSec } from "./demo-universe";
import { createDemoExchange } from "./demo";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

describe("demo exchange", () => {
  it("lists deep-book windows for both series, rolling on the universe clock", async () => {
    const demo = createDemoExchange();
    const rows = await demo.listLiveWindows();
    expect(new Set(rows.map((r) => r.asset))).toEqual(new Set(["BTC", "ETH"]));
    for (const w of rows) {
      expect(w.status).toBe(1);
      expect(w.openingPrice).toBeTruthy();
    }
  });

  it("settles at expiry with the deterministic verdict and rolls a successor", async () => {
    const demo = createDemoExchange();
    const live = (await demo.listLiveWindows()).find((w) => w.asset === "BTC")!;
    // Fast-forward the universe clock past this window's expiry.
    const after = live.expiry + 5;
    const later = await createDemoExchange({ now: () => after }).listLiveWindows();
    const next = later.find((w) => w.asset === "BTC")!;
    expect(next.marketId).not.toBe(live.marketId);
    const settled = await createDemoExchange({ now: () => after }).marketById(live.marketId);
    expect(settled?.result).toBe(demoResultFor(live.marketId));
  });

  it("quotes a big stake off the ladder it shows, and refuses nothing a Call can take", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(900) * 30 + 10;
    const demo = createDemoExchange({ now: () => at, account: A });
    const win = (await demo.listLiveWindows()).find((w) => w.asset === "BTC" && w.intervalSec === 900)!;
    const small = await demo.quoteStake(win.marketId, "up", 10n * 10n ** 6n);
    const big = await demo.quoteStake(win.marketId, "up", 500n * 10n ** 6n);
    expect(small).not.toBeNull();
    expect(big).not.toBeNull();
    // 500 tUSDC buys ~50× the contracts of 10 tUSDC and pays a worse average.
    expect(big!.quantity).toBeGreaterThan(small!.quantity * 40n);
    expect(big!.limitPrice).toBeGreaterThan(small!.limitPrice);
    expect(big!.escrow).toBeGreaterThan(400n * 10n ** 6n);
  });

  it("shows a live pool tape and a moving price without any wallet trading", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(900) * 31 + 120;
    const demo = createDemoExchange({ now: () => at });
    const win = (await demo.listLiveWindows()).find((w) => w.asset === "BTC" && w.intervalSec === 900)!;
    const tape = await demo.listMarketFills(win.pool, 6);
    expect(tape.length).toBeGreaterThan(5);
    expect(win.tradeCount).toBe(tape.length);
    expect(win.volumeQuote).toBeGreaterThan(0);
    expect(demo.assetPrice("BTC")?.price).toBeGreaterThan(0);
  });

  it("carries a duel across two browsers through the fills blob", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(300) * 40 + 10;
    const browserA = createDemoExchange({ now: () => at, account: A });
    browserA.actAs(A);
    const win = (await browserA.listLiveWindows()).find((w) => w.asset === "BTC")!;
    const tx = await browserA.iocBuy(win.upSymbol, 19, 0.52);
    expect(tx).toBeTruthy();

    // Export the challenger fill; hydrate it in a second browser.
    const blob = browserA.exportFillsFor([tx!]);
    expect(blob.length).toBe(1);
    const browserB = createDemoExchange({ now: () => at, account: B });
    browserB.hydrateFills(blob);
    const tapeB = await browserB.fillsByPool(win.pool, 6);
    expect(tapeB.some((r) => r.txHash === tx && r.taker?.toLowerCase() === A.toLowerCase())).toBe(true);

    // B accepts; both fills now export into the completed proof link.
    browserB.actAs(B);
    const acceptTx = await browserB.fokBuy(win.downSymbol, 22, 0.44);
    expect(acceptTx).toBeTruthy();
    const tapeAll = await browserB.fillsByPool(win.pool, 6);
    expect(tapeAll.filter((r) => r.txHash === tx || r.txHash === acceptTx).length).toBe(2);
    const both = browserB.exportFillsFor([tx!, acceptTx!]);
    expect(both.length).toBe(2);
  });

  it("mints a claim for the winner when the demo window settles", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(300) * 50 + 10;
    const demo = createDemoExchange({ now: () => at, account: A });
    demo.actAs(A);
    const win = (await demo.listLiveWindows()).find((w) => w.asset === "BTC")!;
    // Buy the side the deterministic verdict will favor.
    const result = demoResultFor(win.marketId);
    await demo.iocBuy(result === "up" ? win.upSymbol : win.downSymbol, 10, 0.5);
    const after = win.expiry + 5;
    const settledExchange = createDemoExchange({ now: () => after, account: A, seedFrom: demo });
    const preview = await settledExchange.previewClaimSession(A);
    expect(preview.windows).toBe(1);
    expect(preview.payout).toBeGreaterThan(0n);
  });

  it("scopes claims to the wallet that won — the loser is never offered a payout", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(300) * 60 + 10;
    const demo = createDemoExchange({ now: () => at, account: A });
    const win = (await demo.listLiveWindows()).find((w) => w.asset === "BTC")!;
    const result = demoResultFor(win.marketId);
    demo.actAs(A);
    await demo.iocBuy(result === "up" ? win.upSymbol : win.downSymbol, 10, 0.5);
    demo.actAs(B);
    await demo.iocBuy(result === "up" ? win.downSymbol : win.upSymbol, 10, 0.5);

    const settled = createDemoExchange({ now: () => win.expiry + 5, seedFrom: demo });
    expect((await settled.previewClaimSession(A)).windows).toBe(1);
    expect((await settled.previewClaimSession(B)).windows).toBe(0);
    const receipt = await settled.claimFinalized(A);
    expect(receipt.windows).toBe(1);
    expect((await settled.previewClaimSession(A)).windows).toBe(0);
  });

  it("does not mint claims for the anonymous tape colour", async () => {
    const at = DEMO_EPOCH_SEC + demoWindowSec(300) * 61 + 10;
    const demo = createDemoExchange({ now: () => at });
    const win = (await demo.listLiveWindows()).find((w) => w.asset === "BTC")!;
    const settled = createDemoExchange({ now: () => win.expiry + 5, seedFrom: demo });
    await settled.marketById(win.marketId);
    expect(settled.state.claims.length).toBe(0);
  });
});

describe("demo cadence coverage (regression)", () => {
  it("lists a live window for every selectable cadence of both assets", async () => {
    const demo = createDemoExchange();
    const rows = await demo.listLiveWindows();
    const seen = new Set(rows.map((w) => `${w.asset}-${w.intervalSec}`));
    for (const asset of ["BTC", "ETH"]) {
      for (const c of [300, 900, 3600, 14400, 86400]) {
        expect(seen.has(`${asset}-${c}`), `${asset}-${c}`).toBe(true);
      }
    }
  });

  it("demo history is scoped to the requested series", async () => {
    const demo = createDemoExchange();
    const rows = await demo.listSeriesHistory("BTC", 3600);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const w = demo.state.windows.find((x) => x.marketId === r.marketId);
      expect(w?.asset ?? "BTC").toBe("BTC");
    }
  });
});
