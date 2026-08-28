import { gateLabel, type Gate, type GateAction } from "./wallet-gate";
import type { WindowPhase } from "./lifecycle";
import { claimSessionCopy } from "./claim-session";

export type TotePrimary =
  | { kind: "wallet"; action: GateAction }
  | { kind: "claim"; windows: number; payout: bigint }
  | { kind: "call" };

/** What the tote shows as the primary chrome. Claim beats Call/approve/wait once Shannon is selected. */
export function totePrimary(input: { gate: Gate; claimable: number; payout?: bigint }): TotePrimary {
  const { gate, claimable } = input;
  if (gate.action === "connect" || gate.action === "switch") {
    return { kind: "wallet", action: gate.action };
  }
  if (claimable > 0) return { kind: "claim", windows: claimable, payout: input.payout ?? 0n };
  if (gate.action === "call") return { kind: "call" };
  return { kind: "wallet", action: gate.action };
}

export function totePrimaryCopy(
  primary: TotePrimary,
  pending: { connecting?: boolean; switching?: boolean; approving?: boolean; claiming?: boolean } = {},
  phase?: WindowPhase | null,
  decimals = 6,
): string {
  if (primary.kind === "claim") {
    return pending.claiming ? "Claiming…" : claimSessionCopy(primary, decimals);
  }
  if (primary.kind === "wallet") return gateLabel(primary.action, pending, phase);
  return "Ready to Call";
}
