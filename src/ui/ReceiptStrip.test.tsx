// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CallReceipt } from "../domain/proof-card";
import { ReceiptStrip } from "./ReceiptStrip";

afterEach(cleanup);

const M = "0x" + "aa".repeat(32);
const M2 = "0x" + "bb".repeat(32);

const receipt = (over: Partial<CallReceipt> = {}): CallReceipt => ({
  asset: "BTC",
  intervalSec: 900,
  side: "up",
  line: "67214.50",
  expiry: 1_700_000_000,
  stake: 10,
  contracts: 15.2,
  avgOdds: 0.61,
  payoutIfWin: 15.2,
  maxLoss: 9.2,
  txHash: "0xabc123",
  marketId: M as `0x${string}`,
  ts: 1_699_999_000,
  ...over,
});

it("renders nothing before any witnessed Call", () => {
  const { container } = render(<ReceiptStrip receipts={[]} />);
  expect(container.textContent).toBe("");
});

it("shows OPEN receipts and settles them from series history with the oracle link", () => {
  render(
    <ReceiptStrip
      receipts={[receipt(), receipt({ marketId: M2 as `0x${string}`, side: "down", ts: 2 })]}
      history={[
        { marketId: M2 as `0x${string}`, expiry: 1, result: "up", oracleQuestionId: "0xq" },
      ]}
    />,
  );
  expect(screen.getByText("OPEN")).toBeTruthy();
  expect(screen.getByText("UP")).toBeTruthy();
  expect(screen.getAllByRole("button").length).toBe(2);
  expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Share settled receipt" })).toBeTruthy();
});

it("copies the receipt text and flashes confirmation", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<ReceiptStrip receipts={[receipt()]} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  expect(writeText).toHaveBeenCalledOnce();
  const text = writeText.mock.calls[0][0] as string;
  expect(text).toContain("shannon-explorer.somnia.network/tx/0xabc123");
  expect(text).toContain("67214.50");
});
