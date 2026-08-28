import { windowPhaseCopy, type WindowPhase } from "./lifecycle";

export type GateAction = "connect" | "switch" | "approve" | "call" | "wait";

export type Gate = { action: GateAction; canCall: boolean };

export function nextGate(input: {
  connected: boolean;
  chainId: number | undefined;
  expectedChainId: number;
  allowance: bigint;
  stakeRaw: bigint;
  callable: boolean;
}): Gate {
  if (!input.connected) return { action: "connect", canCall: false };
  if (input.chainId !== input.expectedChainId) return { action: "switch", canCall: false };
  if (input.allowance < input.stakeRaw) return { action: "approve", canCall: false };
  if (!input.callable) return { action: "wait", canCall: false };
  return { action: "call", canCall: true };
}

/** Exact tUSDC the pool may pull for this Call. Zero stake → do not approve. Never max-uint. */
export function approveAmount(stakeRaw: bigint): bigint {
  return stakeRaw > 0n ? stakeRaw : 0n;
}

export function gateLabel(
  action: GateAction,
  pending: { connecting?: boolean; switching?: boolean; approving?: boolean } = {},
  phase?: WindowPhase | null,
): string {
  if (action === "connect") return pending.connecting ? "Connecting…" : "Connect wallet";
  if (action === "switch") return pending.switching ? "Switching…" : "Switch to Shannon";
  if (action === "approve") return pending.approving ? "Approving…" : "Approve tUSDC";
  if (action === "wait") return phase ? windowPhaseCopy(phase) : "Window not callable";
  return "Ready to Call";
}
