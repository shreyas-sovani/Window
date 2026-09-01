// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Duel as DuelState } from "../domain/duel";
import { Duel } from "./Duel";

afterEach(cleanup);

const CHALLENGER = "0x00000000000000000000000000000000000000aa";
const ACCEPTOR = "0x00000000000000000000000000000000000000bb";
const M = "0x" + "11".repeat(32);

const challengerFill = {
  account: CHALLENGER,
  marketId: M,
  side: "up" as const,
  contracts: 18,
  avgOdds: 0.55,
  escrow: 9.9,
  txHash: "0xchallengerfill",
  ts: 1_200,
};

const acceptorFill = {
  account: ACCEPTOR,
  marketId: M,
  side: "down" as const,
  contracts: 22,
  avgOdds: 0.42,
  escrow: 31.2,
  txHash: "0xacceptorfill",
  ts: 1_400,
};

const base = {
  marketId: M,
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  line: "67214.50",
};

it("refuses an invalid challenge with its reason and keeps the solo terminal available", () => {
  const state: DuelState = { kind: "invalid", reason: "self-accept" };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getByText("The same wallet cannot accept its own challenge.")).toBeTruthy();
  // One sentence + the solo board — no extra small-print.
  expect(screen.queryByText(/solo Call still works/i)).toBeNull();
});

it("challenge: shows the verified fill, the opposite side to take, and the social-not-counterparty sentence", () => {
  const state: DuelState = {
    kind: "challenge",
    challenge: { ...base, challenger: CHALLENGER, side: "up", stake: 9.9, contracts: 18, avgOdds: 0.55, txHash: "0xchallengerfill" },
  };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getAllByText(/…00aa/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Called UP/i)).toBeTruthy();
  expect(screen.getByText(/18\.00/)).toBeTruthy();
  expect(screen.getByText(/67214\.50/)).toBeTruthy();
  expect(screen.getByText(/opponents are not counterparties/i)).toBeTruthy();
  expect(screen.getByRole("button", { name: /call down to accept challenge/i })).toBeTruthy();
});

it("open: both wallets, both explorer txs, unequal stakes visible, settles at lock", () => {
  const state: DuelState = {
    kind: "open",
    duel: { ...base, challengerFill, acceptorFill },
  };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getByRole("heading", { level: 1, name: "Duel" })).toBeTruthy();
  expect(screen.getByText(/…00aa/i)).toBeTruthy();
  expect(screen.getByText(/…00bb/i)).toBeTruthy();
  expect(screen.getByText(/9\.90/)).toBeTruthy();
  expect(screen.getByText(/31\.20/)).toBeTruthy();
  const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(links).toContain("https://shannon-explorer.somnia.network/tx/0xchallengerfill");
  expect(links).toContain("https://shannon-explorer.somnia.network/tx/0xacceptorfill");
  expect(screen.getByText(/settles when the Window locks/i)).toBeTruthy();
});

it("settled: names the winner by wallet and side, with both proofs and the Line", () => {
  const state: DuelState = {
    kind: "settled",
    ...base,
    winner: challengerFill,
    loser: acceptorFill,
  };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getByText(/winner/i)).toBeTruthy();
  expect(screen.getAllByText(/…00aa/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/UP wins/i)).toBeTruthy();
  const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
  expect(links).toContain("https://shannon-explorer.somnia.network/tx/0xchallengerfill");
});

it("void: a draw — no winner is invented", () => {
  const state: DuelState = {
    kind: "void",
    duel: { ...base, challengerFill, acceptorFill },
  };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getByText(/void — a draw/i)).toBeTruthy();
  expect(screen.queryByText(/winner/i)).toBeNull();
});

it("expired: one fill before lock is an expired challenge, not a win", () => {
  const state: DuelState = {
    kind: "expired",
    challenge: { ...base, challenger: CHALLENGER, side: "up", stake: 9.9, contracts: 18, avgOdds: 0.55, txHash: "0xchallengerfill" },
  };
  render(<Duel duel={state} onAccept={() => {}} acceptBusy={false} />);
  expect(screen.getAllByText(/expired/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/not a win/i)).toBeTruthy();
});
