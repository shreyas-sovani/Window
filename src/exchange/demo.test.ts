import { describe, expect, it } from "vitest";
import { demoResultFor, DEMO_EPOCH_SEC, DEMO_WINDOW_SEC } from "./demo-universe";
import { createDemoExchange } from "./demo";

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";

describe("demo exchange", () => {
  it("lists deep-book windows for both series, rolling on the universe clock", async () => {
    const demo = createDemoExchange();
    const rows = await demo.listLiveWindows();
    expect(rows.map((r) => r.asset).sort()).toEqual(["BTC", "ETH"]);
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

  it("carries a duel across two browsers through the fills blob", async () => {
    const at = DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 40 + 10;
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
    const at = DEMO_EPOCH_SEC + DEMO_WINDOW_SEC * 50 + 10;
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
});
