export function revertCopy(err: unknown): string {
  const text = stringify(err);

  if (/user rejected|rejected the request/i.test(text)) return "Wallet rejected the signature.";
  if (/InvalidPrice/i.test(text)) return "Price is off the tick grid. Refresh the odds and try again.";
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

  return "The transaction did not go through. Check Shannon, gas (STT), and that the Window is still Trading.";
}

function stringify(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return `${err.name} ${err.message} ${err.stack ?? ""}`;
  if (err && typeof err === "object") {
    const o = err as { shortMessage?: string; message?: string; details?: string };
    return `${o.shortMessage ?? ""} ${o.message ?? ""} ${o.details ?? ""} ${JSON.stringify(err)}`;
  }
  return String(err);
}
