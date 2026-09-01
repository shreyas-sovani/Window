import { describe, expect, it } from "vitest";
import {
  challengeHref,
  challengePayloadFromReceipt,
  challengeableReceipt,
  decodeChallengeLink,
  encodeChallenge,
  type ChallengeLinkPayload,
} from "./challenge-link";
import type { CallReceipt } from "./proof-card";

const payload: ChallengeLinkPayload = {
  marketId: "0x" + "11".repeat(32),
  challenger: "0x00000000000000000000000000000000000000aa",
  side: "up",
  stake: 9.9,
  txHash: "0x" + "22".repeat(32),
  expiry: 1_777_777_777,
};

describe("challenge link", () => {
  it("round-trips a payload through #/app?d=…", () => {
    const encoded = encodeChallenge(payload);
    expect(decodeChallengeLink(encoded)).toEqual(payload);
  });

  it("produces a URL-safe encoding with the version tag", () => {
    const encoded = encodeChallenge(payload);
    expect(encoded.startsWith("1.")).toBe(true);
    expect(encoded).toMatch(/^[1A-Za-z0-9._-]+$/);
    expect(challengeHref(payload)).toBe(`#/app?d=${encoded}`);
  });

  it("decode failure is null — never a throw, never a partial payload", () => {
    expect(decodeChallengeLink(null)).toBeNull();
    expect(decodeChallengeLink("")).toBeNull();
    expect(decodeChallengeLink("garbage")).toBeNull();
    expect(decodeChallengeLink("2.abc")).toBeNull();
    expect(decodeChallengeLink("1.!!!not-base64!!!")).toBeNull();
  });

  it("a tampered payload fails validation", () => {
    const good = encodeChallenge(payload);
    const tampered = good.slice(0, -4) + "AAAA";
    const decoded = decodeChallengeLink(tampered);
    // Either fails to parse at all or fails shape validation — never a half-trusted hint.
    if (decoded !== null) expect(decoded).toEqual(payload);
  });

  it("rejects payloads with missing or malformed fields", () => {
    const json = JSON.stringify({ marketId: "not-hex", challenger: "0xaa", side: "maybe", stake: -1 });
    const encoded = "1." + btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallengeLink(encoded)).toBeNull();
  });
});

describe("challengeableReceipt", () => {
  const receipt = (over: Partial<CallReceipt> = {}): CallReceipt => ({
    asset: "BTC",
    intervalSec: 900,
    side: "up",
    line: "67214.50",
    expiry: 1_700_000_000,
    stake: 9.9,
    contracts: 18,
    avgOdds: 0.55,
    payoutIfWin: 18,
    maxLoss: 9.9,
    txHash: "0x" + "22".repeat(32),
    marketId: payload.marketId as `0x${string}`,
    ts: 1_699_999_000,
    ...over,
  });

  it("picks the newest receipt that can still be challenged", () => {
    const older = receipt({ ts: 1, txHash: "0xold" });
    const newer = receipt({ ts: 2, side: "down" });
    expect(challengeableReceipt([older, newer], payload.challenger, 1_699_999_100)?.ts).toBe(2);
  });

  it("returns null with no wallet, no fill hash, or an expired Window", () => {
    expect(challengeableReceipt([receipt()], undefined, 1_699_999_100)).toBeNull();
    expect(challengeableReceipt([receipt({ txHash: "" })], payload.challenger, 1_699_999_100)).toBeNull();
    expect(challengeableReceipt([receipt()], payload.challenger, 1_700_000_001)).toBeNull();
  });
});

describe("challengePayloadFromReceipt", () => {
  const receipt: CallReceipt = {
    asset: "BTC",
    intervalSec: 900,
    side: "up",
    line: "67214.50",
    expiry: 1_700_000_000,
    stake: 9.9,
    contracts: 18,
    avgOdds: 0.55,
    payoutIfWin: 18,
    maxLoss: 9.9,
    txHash: "0x" + "22".repeat(32),
    marketId: payload.marketId as `0x${string}`,
    ts: 1_699_999_000,
  };

  it("builds the link payload from a verified fill and its wallet", () => {
    expect(challengePayloadFromReceipt(receipt, payload.challenger)).toEqual({
      marketId: payload.marketId,
      challenger: payload.challenger,
      side: "up",
      stake: 9.9,
      txHash: "0x" + "22".repeat(32),
      expiry: 1_700_000_000,
    });
  });

  it("refuses without a wallet to name as challenger, without a fill hash, or after the Window expired", () => {
    expect(challengePayloadFromReceipt(receipt, undefined)).toBeNull();
    expect(challengePayloadFromReceipt({ ...receipt, txHash: "" }, payload.challenger)).toBeNull();
    expect(challengePayloadFromReceipt({ ...receipt, expiry: 1 }, payload.challenger, 2)).toBeNull();
  });
});
