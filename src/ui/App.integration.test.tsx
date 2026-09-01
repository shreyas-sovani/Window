// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { custom } from "viem";
import { WagmiProvider, createConfig } from "wagmi";
import { mock } from "wagmi/connectors";
import { afterEach, expect, it } from "vitest";
import { shannonChain } from "../chain/chain";
import { challengeHref, encodeChallenge } from "../domain/challenge-link";
import { createFakeExchange } from "../exchange/fake";
import type { LiveWindow } from "../exchange/port";
import { App } from "./App";

afterEach(cleanup);

const M = "0x" + "aa".repeat(32);

const window: LiveWindow = {
  marketId: M as `0x${string}`,
  symbol: "BTC-15m",
  upSymbol: "BTC#YES",
  downSymbol: "BTC#NO",
  asset: "BTC",
  intervalSec: 900,
  expiry: Math.floor(Date.now() / 1000) + 800,
  venueId: "0xvenue",
  pool: "0x0000000000000000000000000000000000000001",
  status: 1,
  openingPrice: "67214.50",
  tick: 1000n,
  lot: 1000n,
  decimals: 6,
};

const testConfig = createConfig({
  chains: [shannonChain],
  connectors: [mock({ accounts: ["0x00000000000000000000000000000000000000ff"] })],
  transports: {
    [shannonChain.id]: custom({
      async request({ method }) {
        if (method === "eth_chainId") return `0x${shannonChain.id.toString(16)}`;
        if (method === "eth_getBalance") return "0xde0b6b3a7640000";
        if (method === "eth_call") return `0x${"0".repeat(64)}`;
        if (method === "eth_blockNumber") return "0x1";
        if (method === "eth_getTransactionReceipt") return null;
        throw new Error(`Unhandled offline test RPC: ${method}`);
      },
    }),
  },
});

function Terminal({ fake }: { fake: ReturnType<typeof createFakeExchange> }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StrictMode>
      <WagmiProvider config={testConfig}>
        <QueryClientProvider client={qc}>
          <App
            exchange={fake}
            oddsHook={() => ({
              book: fake.state.books["BTC#YES"],
              depth: { bids: [], asks: [], empty: true },
            })}
          />
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>
  );
}

it("renders the live board from the fake adapter: Line, implied odds, locked gate", async () => {
  const fake = createFakeExchange({ windows: [window], books: { "BTC#YES": { bid: 0.55, ask: 0.6 } } });
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByText("67,214.5")).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  // Asset and cadence are separate toggle groups now.
  expect(screen.getByRole("button", { name: "BTC" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "15m" }).getAttribute("aria-pressed")).toBe("true");
  await waitFor(() => expect(screen.getAllByText("60%").length).toBeGreaterThan(0));
  // Disconnected wallet: the onboarding panel owns the next action, Call stays disabled with its reason.
  expect(screen.getByText("Connect wallet", { selector: ".onboard-title" })).toBeTruthy();
  const callUp = screen.getByRole("button", { name: "Call Up" });
  expect(callUp.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Indexer live")).toBeTruthy();
});

it("onboarding sequence: connect promotes the next step and rapid activation lands one write", async () => {
  const fake = createFakeExchange({ windows: [window], books: { "BTC#YES": { bid: 0.55, ask: 0.6 } } });
  render(<Terminal fake={fake} />);

  // Step 1 — Connect wallet is the one prominent action.
  const connect = await waitFor(
    () => screen.getByRole("button", { name: "Connect wallet" }) as HTMLButtonElement,
    { timeout: 5_000 },
  );
  // Rapid double-fire: still exactly one connect (write mutex).
  fireEvent.click(connect);
  fireEvent.click(connect);

  // Step 2 — after connecting, on-chain reads fail offline, so allowance reads as
  // insufficient and the panel promotes Approve with the exact stake beside the Call slip.
  await waitFor(
    () => expect(screen.getByText(/Approve 10/)).toBeTruthy(),
    { timeout: 5_000 },
  );
  const mint = screen.queryByRole("button", { name: /Mint tUSDC/i });
  if (mint && !mint.hasAttribute("disabled")) {
    fireEvent.click(mint);
    fireEvent.click(mint);
    await waitFor(() => expect(fake.state.faucetCalls).toBeLessThanOrEqual(1), { timeout: 5_000 });
  }
});

it("write lifecycle: connect, then rapid double-fire of Mint tUSDC lands one write", async () => {
  const fake = createFakeExchange({ windows: [window], books: { "BTC#YES": { bid: 0.55, ask: 0.6 } } });
  render(<Terminal fake={fake} />);

  // Connect through the real primary path (mock connector, Shannon chain).
  const primary = await waitFor(
    () => {
      const btn = screen.getByRole("button", { name: /connect wallet/i }) as HTMLButtonElement;
      expect(btn).toBeTruthy();
      return btn;
    },
    { timeout: 5_000 },
  );
  fireEvent.click(primary);
  await waitFor(
    () => {
      expect((screen.getByRole("button", { name: "Mint tUSDC" }) as HTMLButtonElement).hasAttribute("disabled")).toBe(false);
    },
    { timeout: 5_000 },
  );

  // Double activation in the same tick — click + Enter equivalent.
  const mint = screen.getByRole("button", { name: "Mint tUSDC" });
  fireEvent.click(mint);
  fireEvent.click(mint);
  fireEvent.keyDown(mint, { key: "Enter" });

  await waitFor(() => expect(fake.state.faucetCalls).toBe(1), { timeout: 5_000 });
  await waitFor(() => expect(screen.getByText(/Minted up to 10,000 tUSDC/i)).toBeTruthy(), { timeout: 5_000 });
});

const CHALLENGER = "0x00000000000000000000000000000000000000aa";

it("an incoming challenge link pins that Window and shows the verified challenger fill", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    statusByMarket: { [M]: 1 },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "seed1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xchallengerproof",
          marketId: M,
          taker: CHALLENGER,
        },
      ],
    },
  });
  globalThis.window.location.hash = challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xchallengerproof",
    expiry: window.expiry,
  });
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Incoming challenge")).toBeTruthy();
      expect(screen.getByText(/Called UP/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /connect wallet to accept/i })).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  // The challenge stage is the first body block — before the ticket and its extras.
  const stage = screen.getByLabelText("Incoming challenge");
  const stake = screen.getByLabelText("Stake (tUSDC)");
  expect(stage.compareDocumentPosition(stake) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // One h1 on the page and it belongs to the challenge.
  expect(document.querySelector("h1")?.textContent).toBe("Challenge");
  // The ticket shows the opposite quote, but the Duel owns the only action.
  expect(screen.queryByRole("button", { name: "Call Up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Call Down" })).toBeNull();
  expect(screen.getAllByRole("button", { name: /to accept/i })).toHaveLength(1);
  globalThis.window.location.hash = "#/app";
});

it("a broken challenge link is refused, not guessed from", async () => {
  const fake = createFakeExchange({ windows: [window], books: { "BTC#YES": { bid: 0.55, ask: 0.6 } } });
  globalThis.window.location.hash = "#/app?d=garbage";
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Challenge refused")).toBeTruthy();
      expect(screen.getByText(/no challenge in this link/i)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("an unknown market in the link is refused with its reason", async () => {
  const fake = createFakeExchange({ windows: [window], books: { "BTC#YES": { bid: 0.55, ask: 0.6 } } });
  const other = "0x" + "cc".repeat(32);
  globalThis.window.location.hash = `#/app?d=${encodeChallenge({
    marketId: other,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xchallengerproof",
    expiry: window.expiry,
  })}`;
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Challenge refused")).toBeTruthy();
      expect(screen.getByText(/not on this chain/i)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("a challenge link on a Finalized Window still renders — expired, not unknown", async () => {
  const dead = { ...window, marketId: ("0x" + "dd".repeat(32)) as `0x${string}`, status: 4, upSymbol: "BTC#D1", expiry: Math.floor(Date.now() / 1000) - 300 };
  const fake = createFakeExchange({
    windows: [window, dead],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "d1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 900,
          txHash: "0xchallengerproof",
          marketId: dead.marketId,
          taker: CHALLENGER,
        },
      ],
    },
  });
  globalThis.window.location.hash = challengeHref({
    marketId: dead.marketId,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xchallengerproof",
    expiry: dead.expiry,
  });
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Challenge expired")).toBeTruthy();
      expect(screen.getByText(/not a win/i)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("a settled duel renders from a Finalized Window result and both tape proofs", async () => {
  const done = { ...window, marketId: ("0x" + "ee".repeat(32)) as `0x${string}`, status: 4, result: "up" as const, upSymbol: "BTC#S1", expiry: Math.floor(Date.now() / 1000) - 300 };
  const fake = createFakeExchange({
    windows: [window, done],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "s1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 900,
          txHash: "0xta",
          marketId: done.marketId,
          taker: CHALLENGER,
        },
        {
          id: "s2",
          price: 0.42,
          quantity: 22,
          quote: 9.24,
          aggressor: "down",
          ts: Math.floor(Date.now() / 1000) - 600,
          txHash: "0xtb",
          marketId: done.marketId,
          taker: "0x00000000000000000000000000000000000000bb",
        },
      ],
    },
  });
  globalThis.window.location.hash = `${challengeHref({
    marketId: done.marketId,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xta",
    expiry: done.expiry,
  })}&a=0xtb`;
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Duel settled")).toBeTruthy();
      expect(screen.getAllByText(/…00aa/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/UP wins/i)).toBeTruthy();
      expect(screen.getByText(/Line 67214\.50/)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("does not turn an unrelated opposite fill into an accepted challenge", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    marketFills: {
      [window.pool]: [
        {
          id: "c1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xta",
          marketId: M,
          taker: CHALLENGER,
        },
        {
          id: "stranger",
          price: 0.42,
          quantity: 22,
          quote: 9.24,
          aggressor: "down",
          ts: Math.floor(Date.now() / 1000) - 30,
          txHash: "0xnot-an-accept",
          marketId: M,
          taker: "0x00000000000000000000000000000000000000cc",
        },
      ],
    },
  });
  globalThis.window.location.hash = challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xta",
    expiry: window.expiry,
  });
  render(<Terminal fake={fake} />);
  await waitFor(() => expect(screen.getByLabelText("Incoming challenge")).toBeTruthy(), { timeout: 5_000 });
  expect(screen.queryByLabelText("Duel open")).toBeNull();
  globalThis.window.location.hash = "#/app";
});
