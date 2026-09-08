import { describe, expect, it } from "vitest";
import { executeCall, executeFokCall, prepareQuotedCall } from "../domain/call-session";
import {
  acceptedChallengeHref,
  challengePayloadFromReceipt,
  challengeHref,
  decodeChallengeLink,
} from "../domain/challenge-link";
import { decodeDemoFills, encodeDemoFills } from "../domain/demo-state";
import { readDuel, tapeDuelFill } from "../domain/duel";
import { callReceiptFromFill, filledCall } from "../domain/filled-call";
import { hashParam } from "../ui/router";
import { createDemoExchange } from "./demo";
import { DEMO_EPOCH_SEC, demoResultFor, demoWindowSec } from "./demo-universe";

/**
 * The demo mode's whole product loop, walked the way a recording walks it and
 * the way `App` wires it: a Call in one browser mints a self-contained link,
 * a second browser hydrates only that link, accepts on the opposite side, and
 * both browsers then read one duel — challenge, open, settled, claim — from
 * the shared demo universe with no indexer and no chain anywhere.
 */

const A = "0x00000000000000000000000000000000000000aa";
const B = "0x00000000000000000000000000000000000000bb";
const CADENCE = 900;
const usd = (n: number) => BigInt(Math.round(n * 1e6));

/** One demo browser: its own adapter instance on the shared universe clock. */
function browser(account: string, clock: () => number) {
  const exchange = createDemoExchange({ now: clock, account });
  exchange.actAs(account);
  return exchange;
}

async function callSide(
  exchange: ReturnType<typeof createDemoExchange>,
  account: string,
  side: "up" | "down",
  stake: number,
  nowSec: number,
  mode: "ioc" | "fok" = "ioc",
) {
  const win = (await exchange.listLiveWindows()).find(
    (w) => w.asset === "BTC" && w.intervalSec === CADENCE,
  )!;
  const quote = await exchange.quoteStake(win.marketId, side, usd(stake));
  const intent = prepareQuotedCall({ live: win, side, nowSec, quote });
  expect(intent.ok, `sized ${side} Call`).toBe(true);
  const txHash =
    mode === "fok" ? await executeFokCall(exchange, win, intent) : await executeCall(exchange, win, intent);
  expect(txHash).toBeTruthy();
  const verified = filledCall(await exchange.listFills(account as `0x${string}`), {
    side,
    asset: win.asset,
    intervalSec: win.intervalSec,
    txHash,
  });
  expect(verified, "the demo tape verifies the fill").not.toBeNull();
  return { win, txHash: txHash!, filled: verified! };
}

describe("demo mode: a shareable link, end to end", () => {
  it("mints a link from a verified Call that a second browser can accept and settle", async () => {
    // Early in a demo Window so both Calls land inside the callable slice.
    const t0 = DEMO_EPOCH_SEC + demoWindowSec(CADENCE) * 70 + 5;
    const browserA = browser(A, () => t0);

    // 1. Browser A Calls Up, and the receipt comes from the tape, not the intent.
    const called = await callSide(browserA, A, "up", 25, t0);
    expect(called.filled.escrow).toBeGreaterThan(20);
    const receipt = callReceiptFromFill(called.win, called.filled, t0);

    // 2. The challenge link: hint + the demo fills blob, all in the URL.
    const payload = challengePayloadFromReceipt(receipt, A, t0);
    expect(payload, "a verified Call mints a challenge").not.toBeNull();
    const fills = browserA.exportFillsFor([called.txHash]);
    expect(fills.length).toBe(1);
    const href = `${challengeHref({ ...payload!, to: B })}&demo=1&s=${encodeDemoFills(fills)}`;

    // 3. Browser B opens that URL a while later and knows nothing else.
    const t1 = t0 + 40;
    const browserB = browser(B, () => t1);
    const hint = decodeChallengeLink(hashParam(href, "d"));
    expect(hint?.marketId).toBe(called.win.marketId);
    expect(hint?.to).toBe(B);
    const blob = decodeDemoFills(hashParam(href, "s"));
    expect(blob).not.toBeNull();
    browserB.hydrateFills(blob!);

    const windowB = await browserB.marketById(hint!.marketId as `0x${string}`);
    expect(windowB?.marketId).toBe(called.win.marketId);
    const challengerFill = tapeDuelFill(await browserB.fillsByPool(windowB!.pool, 6), {
      marketId: windowB!.marketId,
      txHash: hint!.txHash,
      taker: hint!.challenger,
      side: hint!.side,
    });
    expect(challengerFill?.account.toLowerCase()).toBe(A);
    const asChallenge = readDuel({
      hint: hint!,
      window: { ...windowB!, line: windowB!.openingPrice },
      windowStatus: await browserB.onchainStatus(windowB!.marketId),
      challengerFill,
      acceptorFill: null,
      settlement: null,
      nowSec: t1,
    });
    expect(asChallenge.kind).toBe("challenge");

    // 4. B accepts with a FOK on the opposite side, at or above the floor.
    const accepted = await callSide(browserB, B, "down", 30, t1, "fok");
    const completed = acceptedChallengeHref({ ...payload!, to: B }, accepted.txHash);
    expect(hashParam(completed, "a")).toBe(accepted.txHash);

    const tape = await browserB.fillsByPool(windowB!.pool, 6);
    const acceptorFill = tapeDuelFill(tape, {
      marketId: windowB!.marketId,
      txHash: accepted.txHash,
      side: "down",
    });
    expect(acceptorFill?.account.toLowerCase()).toBe(B);
    const open = readDuel({
      hint: hint!,
      window: { ...windowB!, line: windowB!.openingPrice },
      windowStatus: 1,
      challengerFill,
      acceptorFill,
      settlement: null,
      nowSec: t1,
    });
    expect(open.kind).toBe("open");

    // 5. The Window settles on the demo clock; the duel names a winner and the
    //    winning wallet — only it — is owed a Claim.
    const t2 = called.win.expiry + 5;
    const settledExchange = createDemoExchange({ now: () => t2, account: B, seedFrom: browserB });
    const settledWindow = await settledExchange.marketById(called.win.marketId);
    expect(settledWindow?.status).toBe(4);
    const result = demoResultFor(called.win.marketId);
    expect(settledWindow?.result).toBe(result);
    const settled = readDuel({
      hint: hint!,
      window: { ...settledWindow!, line: settledWindow!.openingPrice },
      windowStatus: 4,
      challengerFill,
      acceptorFill,
      settlement: { result },
      nowSec: t2,
    });
    expect(settled.kind).toBe("settled");
    if (settled.kind !== "settled") throw new Error("unreachable");
    expect(settled.winner.side).toBe(result);
    expect(settled.loser.side).not.toBe(result);
    const winner = settled.winner.account as `0x${string}`;
    const loser = settled.loser.account as `0x${string}`;
    expect((await settledExchange.previewClaimSession(winner)).windows).toBe(1);
    expect((await settledExchange.previewClaimSession(loser)).windows).toBe(0);
    const claim = await settledExchange.claimFinalized(winner);
    expect(claim.payout).toBeGreaterThan(0n);
  });

  it("refuses a link whose fills blob was tampered with, and one that names another wallet", async () => {
    const t0 = DEMO_EPOCH_SEC + demoWindowSec(CADENCE) * 71 + 5;
    const browserA = browser(A, () => t0);
    const called = await callSide(browserA, A, "up", 25, t0);
    const payload = challengePayloadFromReceipt(callReceiptFromFill(called.win, called.filled, t0), A, t0)!;

    // A blob that fails validation hydrates nothing, so the challenge cannot verify.
    expect(decodeDemoFills("1.not-base64!")).toBeNull();
    const browserB = browser(B, () => t0 + 10);
    browserB.hydrateFills(decodeDemoFills("1.not-base64!") ?? []);
    const windowB = await browserB.marketById(payload.marketId as `0x${string}`);
    const noProof = readDuel({
      hint: payload,
      window: { ...windowB!, line: windowB!.openingPrice },
      windowStatus: 1,
      challengerFill: tapeDuelFill(await browserB.fillsByPool(windowB!.pool, 6), {
        marketId: windowB!.marketId,
        txHash: payload.txHash,
        taker: payload.challenger,
        side: payload.side,
      }),
      acceptorFill: null,
      settlement: null,
      nowSec: t0 + 10,
    });
    expect(noProof).toEqual({ kind: "invalid", reason: "missing-fill" });

    // Addressed to B: a third wallet's opposite fill is not an accept.
    const C = "0x00000000000000000000000000000000000000cc";
    browserB.hydrateFills(browserA.exportFillsFor([called.txHash]));
    const addressed = { ...payload, to: B };
    const tape = await browserB.fillsByPool(windowB!.pool, 6);
    const challengerFill = tapeDuelFill(tape, {
      marketId: windowB!.marketId,
      txHash: payload.txHash,
      taker: payload.challenger,
      side: payload.side,
    });
    browserB.actAs(C);
    const strangerTx = (await callSide(browserB, C, "down", 30, t0 + 10, "fok")).txHash;
    const strangerFill = tapeDuelFill(await browserB.fillsByPool(windowB!.pool, 6), {
      marketId: windowB!.marketId,
      txHash: strangerTx,
      side: "down",
    });
    const refused = readDuel({
      hint: addressed,
      window: { ...windowB!, line: windowB!.openingPrice },
      windowStatus: 1,
      challengerFill,
      acceptorFill: strangerFill,
      settlement: null,
      nowSec: t0 + 10,
    });
    expect(refused).toEqual({ kind: "invalid", reason: "not-your-duel" });
  });
});
