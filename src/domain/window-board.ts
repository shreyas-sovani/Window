import { parseUnits } from "viem";
import type { BookTop, LiveWindow, StakeQuote } from "../exchange/port";
import { prepareCall, prepareQuotedCall, type PreparedCall } from "./call-session";
import { impliedUp } from "./implied";
import { windowPhase, type WindowPhase } from "./lifecycle";
import { pickWindow } from "./pick-window";
import { nextGate, type Gate } from "./wallet-gate";

export type WindowBoard = {
  live: LiveWindow | null;
  implied: number | undefined;
  upPlan: PreparedCall;
  downPlan: PreparedCall;
  stakeRaw: bigint;
  gate: Gate;
  thinBook: boolean;
  shortCollateral: boolean;
  phase: WindowPhase | null;
};

/** Read model for the Call ticket: live Window, implied Up, plans, and WalletGate. */
export function readBoard(input: {
  windows: LiveWindow[];
  asset: string;
  intervalSec: number;
  nowSec: number;
  venueId?: string;
  book: BookTop | undefined;
  upQuote?: StakeQuote;
  downQuote?: StakeQuote;
  stake: number;
  connected: boolean;
  chainId: number | undefined;
  expectedChainId: number;
  allowance: bigint;
  collateral?: bigint;
  collateralDecimals?: number;
}): WindowBoard {
  const live = pickWindow(input.windows, input.asset, input.intervalSec, input.nowSec, input.venueId);
  const implied = impliedUp(input.book) ?? live?.impliedUp;
  const upPlan = input.upQuote
    ? prepareQuotedCall({ live, side: "up", nowSec: input.nowSec, quote: input.upQuote })
    : prepareCall({ live, book: input.book, stake: input.stake, side: "up", nowSec: input.nowSec });
  const downPlan = input.downQuote
    ? prepareQuotedCall({ live, side: "down", nowSec: input.nowSec, quote: input.downQuote })
    : prepareCall({ live, book: input.book, stake: input.stake, side: "down", nowSec: input.nowSec });
  const decimals = live?.decimals ?? input.collateralDecimals ?? 6;
  const stakeRaw =
    Number.isFinite(input.stake) && input.stake > 0 ? parseUnits(String(input.stake), decimals) : 0n;
  const gate = nextGate({
    connected: input.connected,
    chainId: input.chainId,
    expectedChainId: input.expectedChainId,
    allowance: input.allowance,
    stakeRaw,
    callable: Boolean(live) && upPlan.ok,
  });
  return {
    live,
    implied,
    upPlan,
    downPlan,
    stakeRaw,
    gate,
    thinBook: Boolean(live) && implied === undefined,
    shortCollateral: input.collateral !== undefined && input.collateral < stakeRaw,
    phase: live
      ? windowPhase({
          status: live.status,
          nowSec: input.nowSec,
          expirySec: live.expiry,
          intervalSec: live.intervalSec,
        })
      : null,
  };
}
