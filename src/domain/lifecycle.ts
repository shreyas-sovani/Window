const TRADING = 1;

const LABELS: Record<string, number> = {
  Listed: 0,
  Trading: 1,
  Locked: 2,
  Settling: 3,
  Resolved: 4,
  Voided: 5,
  Finalized: 4,
};

export function statusCode(status: number | string): number {
  if (typeof status === "number") return status;
  return LABELS[status] ?? -1;
}

export type Callability = { callable: true } | { callable: false; reason: "not-trading" | "too-close" };

/** Headroom is 10% of the series interval, clamped so 5m Windows stay tradable. */
export function headroomSec(intervalSec: number): number {
  return Math.min(120, Math.max(15, Math.floor(intervalSec * 0.1)));
}

export function callability(input: {
  status: number | string;
  nowSec: number;
  expirySec: number;
  intervalSec: number;
}): Callability {
  if (statusCode(input.status) !== TRADING) return { callable: false, reason: "not-trading" };
  const left = input.expirySec - input.nowSec;
  if (left < headroomSec(input.intervalSec)) return { callable: false, reason: "too-close" };
  return { callable: true };
}

export type WindowPhase = {
  kind: "trading" | "too-close" | "locked" | "settling" | "resolved" | "voided";
};

/** Display phase for the tote. Callability still gates writes; this only names what the board is showing. */
export function windowPhase(input: {
  status: number | string;
  nowSec: number;
  expirySec: number;
  intervalSec: number;
}): WindowPhase {
  const code = statusCode(input.status);
  if (code === 5) return { kind: "voided" };
  if (code === 4) return { kind: "resolved" };
  if (code === 3) return { kind: "settling" };
  if (code === 2) return { kind: "locked" };
  const gate = callability(input);
  if (gate.callable) return { kind: "trading" };
  if (gate.reason === "too-close") return { kind: "too-close" };
  return { kind: "locked" };
}

export function windowPhaseCopy(phase: WindowPhase): string {
  switch (phase.kind) {
    case "trading":
      return "Trading";
    case "too-close":
      return "Locking — new Calls closed";
    case "locked":
      return "Locked — waiting on the close";
    case "settling":
      return "Settling";
    case "resolved":
      return "Resolved — Claim";
    case "voided":
      return "Voided — Claim both sides";
  }
}
