export function revertCopy(err: unknown): string {
  const text = stringify(err);

  if (/user rejected|rejected the request/i.test(text)) return "Wallet rejected the signature.";
  if (/InvalidPrice/i.test(text)) return "Price is off the tick grid. Refresh the odds and try again.";
  // Whole-or-nothing: the pool refuses a fill-or-kill it cannot fill completely,
  // which is what a duel accept sends. Thin opposite side, not a wallet problem.
  if (/FillOrKillNotFillable/i.test(text)) {
    return "The opposite side cannot fill the whole stake right now, so nothing was sent. Try a smaller stake at or above the floor, or wait for depth.";
  }
  if (/ERC20InsufficientAllowance/i.test(text)) {
    return "The approved tUSDC does not cover this order. Approve the stake again and retry.";
  }
  if (/ERC20InsufficientBalance/i.test(text)) return "Not enough collateral in this wallet.";
  if (/InsufficientBalance/i.test(text)) return "Not enough outcome tokens to sell.";
  if (/FaucetCapExceeded/i.test(text)) return "Faucet cap is 10,000 tUSDC per mint.";
  if (/PostOnlyWouldCross/i.test(text)) return "The book moved through that price.";
  if (/OrderAlreadyExpired/i.test(text)) return "That order expiry is in the past.";
  if (/below-lot/i.test(text)) return "Stake is below one lot. Increase the amount.";
  if (/Window is not Trading/i.test(text)) return "Window is not Trading.";
  if (/SignerRequired/i.test(text)) return "Connect a wallet before this write.";
  if (/reverted on-chain|redeem reverted/i.test(text)) {
    return "The pool reverted that write. The Window may have locked, or size/price is off the grid.";
  }
  // An unmapped revert still carries the pool's own error name. Say it: a
  // named refusal is diagnosable, "check your gas" sends people hunting a
  // problem they do not have. Arguments and addresses stay out of the banner.
  const named = /reverted:\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(text);
  if (named) return `The pool refused that write: ${named[1]}. Nothing was sent.`;

  return "The transaction did not go through. Check Shannon, gas (STT), and that the Window is still Trading.";
}

function stringify(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return `${err.name} ${err.message}`;
  if (err && typeof err === "object") {
    const o = err as { shortMessage?: string; message?: string; details?: string };
    // shortMessage/message/details only — stacks and serialized internals never reach the banner.
    return `${o.shortMessage ?? ""} ${o.message ?? ""} ${o.details ?? ""}`.slice(0, 240);
  }
  return String(err);
}
