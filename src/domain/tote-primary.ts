import { gateLabel, type Gate, type GateAction } from "./wallet-gate";
import type { WindowPhase } from "./lifecycle";

export type TotePrimary =
  | { kind: "wallet"; action: GateAction }
  | { kind: "claim"; count: number }
  | { kind: "call" };

/** What the tote shows as the primary chrome. Claim beats Call/approve/wait once Shannon is selected. */
export function totePrimary(input: { gate: Gate; claimable: number }): TotePrimary {
  const { gate, claimable } = input;
  if (gate.action === "connect" || gate.action === "switch") {
    return { kind: "wallet", action: gate.action };
  }
  if (claimable > 0) return { kind: "claim", count: claimable };
  if (gate.action === "call") return { kind: "call" };
  return { kind: "wallet", action: gate.action };
}

export function totePrimaryCopy(
  primary: TotePrimary,
  pending: { connecting?: boolean; switching?: boolean; approving?: boolean; claiming?: boolean } = {},
  phase?: WindowPhase | null,
): string {
  if (primary.kind === "claim") return pending.claiming ? "Claiming…" : "Claim winnings";
  if (primary.kind === "wallet") return gateLabel(primary.action, pending, phase);
  return "Ready to Call";
}
