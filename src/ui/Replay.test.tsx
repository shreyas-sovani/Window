// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createFakeExchange } from "../exchange/fake";
import type { LiveWindow } from "../exchange/port";
import { Replay } from "./Replay";

afterEach(cleanup);

const M = "0x" + "11".repeat(32);
const POOL = "0x0000000000000000000000000000000000000001";

const win: LiveWindow = {
  marketId: M as `0x${string}`,
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  downSymbol: "BTC#NO",
  asset: "BTC",
  intervalSec: 900,
  expiry: 2_000,
  venueId: "0xvenue",
  pool: POOL as `0x${string}`,
  status: 4,
  openingPrice: "67214.50",
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
};

const tape = [
  {
    id: "r1",
    price: 0.55,
    quantity: 18,
    quote: 9.9,
    aggressor: "up" as const,
    ts: 1_200,
    txHash: "0xta",
    marketId: M,
    taker: "0x00000000000000000000000000000000000000aa",
  },
  {
    id: "r2",
    price: 0.42,
    quantity: 22,
    quote: 9.24,
    aggressor: "down" as const,
    ts: 1_400,
    txHash: "0xtb",
    marketId: M,
    taker: "0x00000000000000000000000000000000000000bb",
  },
];

function field(label: RegExp, value: string) {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

it("reconstructs a settled duel from a pinned marketId, two txs, and the outcome", async () => {
  const fake = createFakeExchange({ windows: [win], marketFills: { [POOL]: tape } });
  render(<Replay exchange={fake} />);
  field(/marketid/i, M);
  field(/first tx hash/i, "0xta");
  field(/second tx hash/i, "0xtb");
  fireEvent.change(screen.getByLabelText(/outcome/i) as HTMLSelectElement, { target: { value: "up" } });
  fireEvent.click(screen.getByRole("button", { name: /reconstruct/i }));
  await waitFor(() => expect(screen.getByLabelText("Duel settled")).toBeTruthy(), { timeout: 4_000 });
  expect(screen.getAllByText(/…00aa/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/UP wins/i)).toBeTruthy();
  expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(2);
});

it("fails closed when a hash is not a fill on that market", async () => {
  const fake = createFakeExchange({ windows: [win], marketFills: { [POOL]: tape } });
  render(<Replay exchange={fake} />);
  field(/marketid/i, M);
  field(/first tx hash/i, "0xnotaround");
  field(/second tx hash/i, "0xtb");
  fireEvent.change(screen.getByLabelText(/outcome/i) as HTMLSelectElement, { target: { value: "up" } });
  fireEvent.click(screen.getByRole("button", { name: /reconstruct/i }));
  await waitFor(() => expect(screen.getByText(/not a verified fill/i)).toBeTruthy(), { timeout: 4_000 });
  expect(screen.queryByLabelText("Duel settled")).toBeNull();
});

it("fails closed when the marketId is unknown to the chain", async () => {
  const fake = createFakeExchange({ windows: [win], marketFills: { [POOL]: tape } });
  render(<Replay exchange={fake} />);
  field(/marketid/i, "0x" + "ff".repeat(32));
  field(/first tx hash/i, "0xta");
  field(/second tx hash/i, "0xtb");
  fireEvent.change(screen.getByLabelText(/outcome/i) as HTMLSelectElement, { target: { value: "up" } });
  fireEvent.click(screen.getByRole("button", { name: /reconstruct/i }));
  await waitFor(() => expect(screen.getByText(/cannot be verified|not on this chain/i)).toBeTruthy(), { timeout: 4_000 });
});
