import { describe, expect, it } from "vitest";
import { chipStatus, nextStep, stepAction, stepExplanation } from "./onboarding";

const base = {
  connected: true,
  chainId: 50312,
  expectedChainId: 50312,
  stakeRaw: 10_000_000n,
  allowance: 10_000_000n,
  collateral: 50_000_000n,
  callable: true,
  claimable: 0,
};

describe("nextStep", () => {
  it("starts at connect", () => {
    const step = nextStep({ ...base, connected: false });
    expect(step.kind).toBe("connect");
    expect(step.title).toBe("Connect wallet");
    expect(stepExplanation(step)).toMatch(/shannon/i);
  });

  it("switches network before anything else on-chain", () => {
    const step = nextStep({ ...base, chainId: 1 });
    expect(step.kind).toBe("switch");
    expect(stepExplanation(step)).toMatch(/50312/);
  });

  it("asks for gas only when the wallet provably has none", () => {
    expect(nextStep({ ...base, hasGas: false }).kind).toBe("gas");
    expect(nextStep({ ...base, hasGas: true }).kind).toBe("call");
    expect(nextStep({ ...base }).kind).toBe("call"); // unknown gas never blocks
  });

  it("mints before approving when collateral cannot cover the stake", () => {
    const step = nextStep({ ...base, collateral: 1_000_000n });
    expect(step.kind).toBe("mint");
    expect(stepExplanation(step)).toMatch(/faucet/i);
  });

  it("names the exact stake on the approve step", () => {
    const step = nextStep({ ...base, allowance: 0n }, 6);
    expect(step.kind).toBe("approve");
    expect(stepAction(step)).toContain("10");
  });

  it("lands on call when everything is ready", () => {
    expect(nextStep(base).kind).toBe("call");
  });

  it("explains a not-yet-callable Window without hiding the reason", () => {
    const step = nextStep({ ...base, callable: false });
    expect(step.kind).toBe("wait");
    expect(stepExplanation(step)).toBeTruthy();
  });
});

describe("chipStatus", () => {
  const w = (over: Partial<Parameters<typeof chipStatus>[0]["windows"][number]>) => over;

  it("says trading for a live Trading row, waiting for a locked row, none otherwise", () => {
    const windows = [
      w({ asset: "BTC", intervalSec: 900, status: 1, expiry: 9_000 }),
      w({ asset: "ETH", intervalSec: 300, status: 2, expiry: 1_000 }),
    ] as never;
    expect(chipStatus(windows, "BTC", 900, 1_000)).toBe("trading");
    expect(chipStatus(windows, "ETH", 300, 1_000)).toBe("waiting");
    expect(chipStatus(windows, "ETH", 900, 1_000)).toBe("none");
  });

  it("snaps cadence before matching", () => {
    const windows = [w({ asset: "BTC", intervalSec: 3598, status: 1, expiry: 9_000 })] as never;
    expect(chipStatus(windows, "BTC", 3600, 1_000)).toBe("trading");
  });
});
