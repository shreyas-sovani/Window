export type BoardNotice = {
  kind: "err" | "info";
  text: string;
  action?: "Retry" | "Switch series" | "Mint tUSDC";
};

/** Highest-priority empty / error / thin-book notice with a next action. */
export function boardNotice(input: {
  loadError: string | null;
  loading: boolean;
  live: boolean;
  thinBook: boolean;
  shortCollateral: boolean;
}): BoardNotice | null {
  if (input.loadError) return { kind: "err", text: input.loadError, action: "Retry" };
  if (input.loading && !input.live) {
    return { kind: "info", text: "Reading live Windows from the Event Contract indexer…" };
  }
  if (!input.live) {
    return {
      kind: "info",
      text: "No Trading Window for this series right now. Try another cadence or wait for the roll.",
      action: "Switch series",
    };
  }
  if (input.shortCollateral) {
    return { kind: "info", text: "Not enough tUSDC in this wallet to cover this stake.", action: "Mint tUSDC" };
  }
  if (input.thinBook) {
    return { kind: "info", text: "No resting liquidity yet. A Call still sizes at 50% if you proceed." };
  }
  return null;
}

/** Render-crash fallback. First line only — never a stack. Retry remounts the tree. */
export function crashNotice(message: string): BoardNotice {
  const line = message.trim().split(/\n/)[0]?.slice(0, 160) || "Something broke in the board.";
  return {
    kind: "err",
    text: `The board hit an unexpected error: ${line} Retry — your on-chain positions are safe.`,
    action: "Retry",
  };
}
