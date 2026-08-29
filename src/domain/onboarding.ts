import type { LiveWindow } from "../exchange/port";
import { statusCode } from "./lifecycle";
import { canonicalInterval } from "./series";

export type StepKind = "connect" | "switch" | "gas" | "mint" | "approve" | "wait" | "call";

export type OnboardingStep = {
  kind: StepKind;
  title: string;
  action: string;
  explanation: string;
};

function fmtStake(raw: bigint, decimals: number): string {
  return (Number(raw) / 10 ** decimals).toFixed(2);
}

/**
 * The one guided next action, in order: connect → switch → gas → mint → approve → wait → call.
 * Gas is only a step when the wallet provably has none (unknown never blocks). Claim is
 * deliberately NOT in this chain — it is a rewards section, not a gate before the next Call.
 */
export function nextStep(
  input: {
    connected: boolean;
    chainId: number | undefined;
    expectedChainId: number;
    hasGas?: boolean;
    collateral?: bigint;
    stakeRaw: bigint;
    allowance: bigint;
    callable: boolean;
    claimable: number;
  },
  decimals = 6,
): OnboardingStep {
  if (!input.connected) {
    return {
      kind: "connect",
      title: "Connect wallet",
      action: "Connect wallet",
      explanation: "Connect a Shannon wallet to Call the next Window.",
    };
  }
  if (input.chainId !== input.expectedChainId) {
    return {
      kind: "switch",
      title: "Switch to Shannon",
      action: "Switch to Shannon",
      explanation: "Your wallet is on another network. Window trades Event Contracts on Shannon (50312).",
    };
  }
  if (input.hasGas === false) {
    return {
      kind: "gas",
      title: "Get STT for gas",
      action: "Get STT gas",
      explanation: "Every transaction needs a little STT. Use the Somnia faucet, then come back.",
    };
  }
  if (input.collateral !== undefined && input.collateral < input.stakeRaw) {
    return {
      kind: "mint",
      title: "Mint tUSDC",
      action: "Mint tUSDC",
      explanation: "Not enough collateral for this stake. Mint test tUSDC from the dreamDEX faucet (cap 10,000).",
    };
  }
  if (input.allowance < input.stakeRaw) {
    return {
      kind: "approve",
      title: `Approve ${fmtStake(input.stakeRaw, decimals)} tUSDC`,
      action: `Approve ${fmtStake(input.stakeRaw, decimals)} tUSDC`,
      explanation: "The pool pulls exactly this stake when your Call fills — never more.",
    };
  }
  if (!input.callable) {
    return {
      kind: "wait",
      title: "Window not callable",
      action: "",
      explanation:
        "This Window is locking or locked. Wait for the roll, or pick another series — Calls re-open automatically.",
    };
  }
  return { kind: "call", title: "Ready to Call", action: "", explanation: "Pick Up or Down below." };
}

/** Button label for the step (empty when there is nothing to click). */
export function stepAction(step: OnboardingStep): string {
  return step.action;
}

export function stepExplanation(step: OnboardingStep): string {
  return step.explanation;
}

export type ChipStatus = "trading" | "waiting" | "none";

/** Availability of one series chip: Trading now, waiting through lock/roll, or nothing listed. */
export function chipStatus(
  windows: LiveWindow[],
  asset: string,
  intervalSec: number,
  nowSec: number,
): ChipStatus {
  const cadence = canonicalInterval(intervalSec);
  let waiting = false;
  for (const w of windows) {
    if (w.asset !== asset || canonicalInterval(w.intervalSec) !== cadence) continue;
    const code = statusCode(w.status);
    if (code === 1 && w.expiry > nowSec) return "trading";
    if (code === 1 || code === 2 || code === 3) waiting = true;
  }
  return waiting ? "waiting" : "none";
}
