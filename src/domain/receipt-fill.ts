import { keccak256, toHex } from "viem";

/**
 * The chain witness: a Call's fill, decoded from its own transaction receipt.
 * ERC-20 collateral transfers give the wallet's net cost exactly (paid minus
 * refunds — mint-a-pair included, since the sold leg's proceeds come back as a
 * transfer), and the pool's ERC-6901 outcome transfers give the side and
 * contracts. No indexer in the path: the receipt IS the chain's record.
 */

export type RawLog = { address: string; topics: readonly string[]; data: string };

export const RECEIPT_LOG_TOPICS = {
  erc20Transfer: keccak256(toHex("Transfer(address,address,address,uint256)")),
  transferSingle: keccak256(toHex("TransferSingle(address,address,address,uint256,uint256)")),
  transferBatch: keccak256(toHex("TransferBatch(address,address,address,uint256[],uint256[])")),
} as const;

const addr = (topic: string) => ("0x" + topic.slice(-40)).toLowerCase();
const word = (data: string, i: number) => BigInt("0x" + data.slice(2 + i * 64, 2 + (i + 1) * 64));

export type ChainFill = {
  side: "up" | "down";
  contracts: number;
  escrow: number;
  avgOdds: number;
};

/**
 * Returns the Call this receipt proves, or null when the receipt is not a
 * single-side buy by this account on this pool (approve, cancel, exit, both
 * legs, no leg). Escrow is collateral net of every refund in the same tx.
 */
export function fillFromReceiptLogs(
  logs: RawLog[],
  x: { account: string; pool: string; collateral: string; yesId: bigint; noId: bigint; decimals: number },
): ChainFill | null {
  const account = x.account.toLowerCase();
  const pool = x.pool.toLowerCase();
  const collateral = x.collateral.toLowerCase();
  const scale = 10 ** x.decimals;

  let paid = 0n;
  let refunded = 0n;
  let yes = 0n;
  let no = 0n;

  for (const log of logs) {
    if (log.address.toLowerCase() === collateral && log.topics[0] === RECEIPT_LOG_TOPICS.erc20Transfer) {
      const from = addr(log.topics[1] ?? "");
      const to = addr(log.topics[2] ?? "");
      const value = word(log.data, 0);
      if (from === account && to === pool) paid += value;
      if (from === pool && to === account) refunded += value;
      continue;
    }
    if (log.address.toLowerCase() !== pool) continue;
    if (log.topics[0] === RECEIPT_LOG_TOPICS.transferSingle && log.topics.length === 4) {
      const from = addr(log.topics[2] ?? "");
      const to = addr(log.topics[3] ?? "");
      const id = word(log.data, 0);
      const value = word(log.data, 1);
      if (from !== pool || to !== account) continue;
      if (id === x.yesId) yes += value;
      else if (id === x.noId) no += value;
      continue;
    }
    if (log.topics[0] === RECEIPT_LOG_TOPICS.transferBatch && log.topics.length === 4) {
      const from = addr(log.topics[2] ?? "");
      const to = addr(log.topics[3] ?? "");
      if (from !== pool || to !== account) continue;
      // data: offsets head (2 words), then ids[], then values[]
      const idsAt = Number(word(log.data, 0)) / 32;
      const valsAt = Number(word(log.data, 1)) / 32;
      const n = Number(word(log.data, idsAt));
      for (let i = 0; i < n; i += 1) {
        const id = word(log.data, idsAt + 1 + i);
        const value = word(log.data, valsAt + 1 + i);
        if (id === x.yesId) yes += value;
        else if (id === x.noId) no += value;
      }
    }
  }

  const side = yes > 0n && no === 0n ? ("up" as const) : no > 0n && yes === 0n ? ("down" as const) : null;
  if (!side) return null;
  const rawContracts = side === "up" ? yes : no;
  const escrowRaw = paid - refunded;
  if (!(rawContracts > 0n) || !(escrowRaw > 0n)) return null;
  const contracts = Number(rawContracts) / scale;
  const escrow = Number(escrowRaw) / scale;
  return { side, contracts, escrow, avgOdds: escrow / contracts };
}
