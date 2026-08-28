import { describe, expect, it } from "vitest";
import { nextGate } from "./wallet-gate";
import { totePrimary, totePrimaryCopy } from "./tote-primary";

const ready = {
  connected: true,
  chainId: 50312,
  expectedChainId: 50312,
  allowance: 10_000_000n,
  stakeRaw: 10_000_000n,
  callable: true,
};

describe("totePrimary", () => {
  it("makes Claim the primary after resolve even when the successor is callable", () => {
    const gate = nextGate(ready);
    expect(gate.action).toBe("call");
    expect(totePrimary({ gate, claimable: 1 })).toEqual({ kind: "claim", windows: 1, payout: 0n });
    expect(totePrimaryCopy({ kind: "claim", windows: 1, payout: 5_000_000n })).toBe("Claim 1 Window · 5 tUSDC");
  });

  it("asks to connect before Claim", () => {
    const gate = nextGate({ ...ready, connected: false, chainId: undefined });
    expect(totePrimary({ gate, claimable: 2 })).toEqual({ kind: "wallet", action: "connect" });
  });

  it("asks to switch to Shannon before Claim", () => {
    const gate = nextGate({ ...ready, chainId: 1 });
    expect(totePrimary({ gate, claimable: 1 })).toEqual({ kind: "wallet", action: "switch" });
  });

  it("does not wait on tUSDC approve when Claim is due", () => {
    const gate = nextGate({ ...ready, allowance: 0n });
    expect(gate.action).toBe("approve");
    expect(totePrimary({ gate, claimable: 1 }).kind).toBe("claim");
  });

  it("prefers Claim over a waiting successor", () => {
    const gate = nextGate({ ...ready, callable: false });
    expect(gate.action).toBe("wait");
    expect(totePrimary({ gate, claimable: 1 }).kind).toBe("claim");
  });

  it("stays on Call when nothing is claimable", () => {
    expect(totePrimary({ gate: nextGate(ready), claimable: 0 })).toEqual({ kind: "call" });
  });
});
