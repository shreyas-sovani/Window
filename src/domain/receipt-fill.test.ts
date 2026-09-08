import { describe, expect, it } from "vitest";
import { fillFromReceiptLogs, RECEIPT_LOG_TOPICS, type RawLog } from "./receipt-fill";

const ACCOUNT = "0x00000000000000000000000000000000000000aa";
const POOL = "0x0000000000000000000000000000000000000bbb";
const TUSDC = "0x0000000000000000000000000000000000000eee";
const YES = 1n;
const NO = 2n;

const topic = (addr: string) => "0x" + addr.slice(2).toLowerCase().padStart(64, "0");
const hex32 = (v: bigint) => "0x" + v.toString(16).padStart(64, "0");

function erc20(from: string, to: string, value: bigint): RawLog {
  return {
    address: TUSDC,
    topics: [RECEIPT_LOG_TOPICS.erc20Transfer, topic(from), topic(to)],
    data: hex32(value),
  };
}

function single(from: string, to: string, id: bigint, value: bigint): RawLog {
  return {
    address: POOL,
    topics: [RECEIPT_LOG_TOPICS.transferSingle, topic(POOL), topic(from), topic(to)],
    data: "0x" + hex32(id).slice(2) + hex32(value).slice(2),
  };
}

describe("fillFromReceiptLogs", () => {
  it("reads a resting-order buy: collateral in, one outcome leg out", () => {
    const got = fillFromReceiptLogs(
      [erc20(ACCOUNT, POOL, 9_999_918n), erc20(POOL, ACCOUNT, 2_258_046n), single(POOL, ACCOUNT, NO, 7_741_872n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got).not.toBeNull();
    expect(got!.side).toBe("down");
    expect(got!.contracts).toBeCloseTo(7.741872, 6);
    expect(got!.escrow).toBeCloseTo(7.741872, 6);
    expect(got!.avgOdds).toBeCloseTo(1, 6);
  });

  it("reads a mint-a-pair buy at net cost: the sold leg's refund is not escrow", () => {
    const got = fillFromReceiptLogs(
      [erc20(ACCOUNT, POOL, 24_998_976n), erc20(POOL, ACCOUNT, 350_336n), single(POOL, ACCOUNT, NO, 25_024_000n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got!.side).toBe("down");
    expect(got!.contracts).toBeCloseTo(25.024, 6);
    expect(got!.escrow).toBeCloseTo(24.64864, 6);
    expect(got!.avgOdds).toBeCloseTo(0.985, 6);
  });

  it("splits several outcome legs into per-side contracts; one side only", () => {
    const got = fillFromReceiptLogs(
      [erc20(ACCOUNT, POOL, 20_000_000n), single(POOL, ACCOUNT, YES, 10_000_000n), single(POOL, ACCOUNT, YES, 6_315_600n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got!.side).toBe("up");
    expect(got!.contracts).toBeCloseTo(16.3156, 6);
  });

  it("refuses both sides in one receipt — a Call is one side", () => {
    const got = fillFromReceiptLogs(
      [erc20(ACCOUNT, POOL, 10_000_000n), single(POOL, ACCOUNT, YES, 5_000_000n), single(POOL, ACCOUNT, NO, 5_000_000n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got).toBeNull();
  });

  it("refuses an exit-shaped receipt (collateral out exceeds in) — buys only", () => {
    const got = fillFromReceiptLogs(
      [erc20(POOL, ACCOUNT, 5_000_000n), single(ACCOUNT, POOL, YES, 5_000_000n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got).toBeNull();
  });

  it("refuses receipts with no outcome leg to this account (an approve, a cancel)", () => {
    expect(
      fillFromReceiptLogs([erc20(ACCOUNT, POOL, 9_999_918n)], {
        account: ACCOUNT,
        pool: POOL,
        collateral: TUSDC,
        yesId: YES,
        noId: NO,
        decimals: 6,
      }),
    ).toBeNull();
  });

  it("ignores transfers between other wallets — only this account's legs count", () => {
    const other = "0x00000000000000000000000000000000000000cc";
    const got = fillFromReceiptLogs(
      [erc20(ACCOUNT, POOL, 7_741_872n), erc20(POOL, other, 7_741_872n), single(POOL, ACCOUNT, YES, 7_741_872n)],
      { account: ACCOUNT, pool: POOL, collateral: TUSDC, yesId: YES, noId: NO, decimals: 6 },
    );
    expect(got!.escrow).toBeCloseTo(7.741872, 6);
  });
});
