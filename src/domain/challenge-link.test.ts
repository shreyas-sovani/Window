import { describe, expect, it } from "vitest";
import {
  acceptedChallengeHref,
  challengeHref,
  challengePayloadFromReceipt,
  challengeableReceipt,
  decodeChallengeLink,
  encodeChallenge,
  inviteUntil,
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

  it("round-trips a stake floor when one is set", () => {
    const got = decodeChallengeLink(encodeChallenge({ ...payload, minStake: 9.9 }));
    expect(got?.minStake).toBeCloseTo(9.9, 6);
    expect(decodeChallengeLink(encodeChallenge(payload))?.minStake).toBeUndefined();
  });

  it("rejects a malformed stake floor", () => {
    const json = JSON.stringify({ ...payload, minStake: -3 });
    const encoded = "1." + btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallengeLink(encoded)).toBeNull();
  });

  it("round-trips an intended opponent when one is named", () => {
    const got = decodeChallengeLink(encodeChallenge({ ...payload, to: "0x00000000000000000000000000000000000000bb" }));
    expect(got?.to?.toLowerCase()).toBe("0x00000000000000000000000000000000000000bb");
    // Legacy links without an opponent still decode.
    expect(decodeChallengeLink(encodeChallenge(payload))?.to).toBeUndefined();
  });

  it("rejects a malformed opponent address", () => {
    const json = JSON.stringify({ ...payload, to: "not-an-address" });
    const encoded = "1." + btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallengeLink(encoded)).toBeNull();
  });

  it("produces a URL-safe encoding with the v2 tag", () => {
    const encoded = encodeChallenge(payload);
    expect(encoded.startsWith("2.")).toBe(true);
    expect(encoded).toMatch(/^[2A-Za-z0-9._-]+$/);
    expect(challengeHref(payload)).toBe(`#/app?d=${encoded}`);
    expect(acceptedChallengeHref(payload, "0xacceptor")).toBe(`#/app?d=${encoded}&a=0xacceptor`);
  });

  it("v2 carries the series the duel is fought on", () => {
    const got = decodeChallengeLink(encodeChallenge({ ...payload, series: { asset: "BTC", intervalSec: 900 } }));
    expect(got?.series).toEqual({ asset: "BTC", intervalSec: 900 });
  });

  it("round-trips an invite-until and refuses a smuggled v1 until", () => {
    const got = decodeChallengeLink(encodeChallenge({ ...payload, until: 1_777_777_800 }));
    expect(got?.until).toBe(1_777_777_800);
    const smuggled =
      "1." +
      btoa(JSON.stringify({ ...payload, until: 1_777_777_800 }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    expect(decodeChallengeLink(smuggled)).toBeNull();
  });

  it("decodes legacy v1 links and rejects tampered ones", () => {
    const legacy =
      "1." + btoa(JSON.stringify({ ...payload })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeChallengeLink(legacy)?.marketId).toBe(payload.marketId);
    // New-shape fields smuggled into a v1 envelope fail closed.
    const smuggled =
      "1." +
      btoa(JSON.stringify({ ...payload, to: "0x00000000000000000000000000000000000000bb" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    expect(decodeChallengeLink(smuggled)).toBeNull();
    expect(decodeChallengeLink("3.anything")).toBeNull();
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
    const older = receipt({ ts: 1_699_998_900, txHash: "0xold" });
    const newer = receipt({ ts: 1_699_999_000, side: "down" });
    expect(challengeableReceipt([older, newer], payload.challenger, 1_699_999_050)?.ts).toBe(1_699_999_000);
  });

  it("returns null with no wallet, no fill hash, or an expired Window", () => {
    expect(challengeableReceipt([receipt()], undefined, 1_699_999_050)).toBeNull();
    expect(challengeableReceipt([receipt({ txHash: "" })], payload.challenger, 1_699_999_050)).toBeNull();
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
    expect(challengePayloadFromReceipt(receipt, payload.challenger, 1_699_999_000)).toEqual({
      marketId: payload.marketId,
      challenger: payload.challenger,
      side: "up",
      stake: 9.9,
      txHash: "0x" + "22".repeat(32),
      expiry: 1_700_000_000,
      // The minted link floors the accept at the challenger's own stake and
      // names the series it was fought on.
      minStake: 9.9,
      series: { asset: "BTC", intervalSec: 900 },
      until: inviteUntil({ windowExpiry: 1_700_000_000, fromSec: 1_699_999_000, intervalSec: 900 }),
    });
  });

  it("inviteUntil is the Window headroom after the fill, never past lock", () => {
    // 15m headroom is 90s; a fill 200s before lock closes the invite at fill+90.
    expect(inviteUntil({ windowExpiry: 1_000, fromSec: 800, intervalSec: 900 })).toBe(890);
    expect(inviteUntil({ windowExpiry: 1_000, fromSec: 980, intervalSec: 900 })).toBe(1_000);
    expect(inviteUntil({ windowExpiry: 300, fromSec: 0, intervalSec: 300 })).toBe(30);
  });

  it("does not mint a link after the invite has closed, even if the Window is still live", () => {
    const until = inviteUntil({ windowExpiry: receipt.expiry, fromSec: receipt.ts, intervalSec: 900 });
    expect(challengePayloadFromReceipt(receipt, payload.challenger, until + 1)).toBeNull();
    expect(challengeableReceipt([receipt], payload.challenger, until + 1)).toBeNull();
  });

  it("refuses without a wallet to name as challenger, without a fill hash, or after the Window expired", () => {
    expect(challengePayloadFromReceipt(receipt, undefined)).toBeNull();
    expect(challengePayloadFromReceipt({ ...receipt, txHash: "" }, payload.challenger)).toBeNull();
    expect(challengePayloadFromReceipt({ ...receipt, expiry: 1 }, payload.challenger, 2)).toBeNull();
  });
});
