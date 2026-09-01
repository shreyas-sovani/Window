// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { CallReceipt } from "../domain/proof-card";
import { ChallengeGate, ChallengeStrip } from "./ChallengeStrip";

afterEach(cleanup);

const HREF = "#/app?d=1.abcDEF-_123";

it("renders the challenge as a real link, not a copy-only button", () => {
  render(<ChallengeStrip href={HREF} />);
  const link = screen.getByRole("link", { name: /open the challenge link/i }) as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe(HREF);
});

it("copies exactly the full URL — origin + path + hash — and announces it", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<ChallengeStrip href={HREF} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  await waitFor(() => expect(screen.getByText("Link copied")).toBeTruthy());
  const expected = `${globalThis.window.location.origin}${globalThis.window.location.pathname}${HREF}`;
  expect(writeText).toHaveBeenCalledExactlyOnceWith(expected);
  expect(writeText.mock.calls[0][0]).toBe(expected);
});

const receipt = (over: Partial<CallReceipt> = {}): CallReceipt => ({
  asset: "BTC",
  intervalSec: 900,
  side: "up",
  line: "67214.50",
  expiry: 1_700_000_000,
  stake: 9.9,
  contracts: 18,
  avgOdds: 0.55,
  payoutIfWin: 18,
  maxLoss: 9.9,
  txHash: "0x" + "22".repeat(32),
  marketId: "0x" + "11".repeat(32) as `0x${string}`,
  ts: 1_699_999_000,
  ...over,
});

it("the gate shows the link the moment this session has a verified, live fill", () => {
  const { container } = render(
    <ChallengeGate receipts={[receipt()]} address="0x00000000000000000000000000000000000000aa" now={1_699_999_100} />,
  );
  const link = screen.getByRole("link", { name: /open the challenge link/i }) as HTMLAnchorElement;
  expect(link.getAttribute("href")).toMatch(/^#\/app\?d=1\./);
  expect(container.querySelector("a")).toBe(link);
});

it("no verified fill, no wallet, or an expired Window — no strip at all", () => {
  const { rerender, container } = render(
    <ChallengeGate receipts={[receipt({ txHash: "" })]} address="0xaa" now={1_699_999_100} />,
  );
  expect(container.querySelector("a")).toBeNull();
  rerender(<ChallengeGate receipts={[receipt()]} now={1_699_999_100} />);
  expect(container.querySelector("a")).toBeNull();
  rerender(
    <ChallengeGate receipts={[receipt()]} address="0x00000000000000000000000000000000000000aa" now={1_700_000_001} />,
  );
  expect(container.querySelector("a")).toBeNull();
});
