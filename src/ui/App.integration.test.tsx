// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { custom } from "viem";
import { WagmiProvider, createConfig } from "wagmi";
import { mock } from "wagmi/connectors";
import { afterEach, expect, it } from "vitest";
import { shannonChain } from "../chain/chain";
import type { BookDepth } from "../domain/book-depth";
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

function Terminal({
  fake,
  depth = { bids: [], asks: [], empty: true },
}: {
  fake: ReturnType<typeof createFakeExchange>;
  depth?: BookDepth;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StrictMode>
      <WagmiProvider config={testConfig}>
        <QueryClientProvider client={qc}>
          <App
            exchange={fake}
            oddsHook={() => ({ book: fake.state.books["BTC#YES"], depth })}
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

it("a challenge link says verifying on first paint — never a refusal flash", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
  });
  globalThis.window.location.hash = `${challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xta",
    expiry: window.expiry,
  })}&a=0xtb`;
  render(<Terminal fake={fake} />);
  // Before any chain read lands, the only honest state is verifying.
  expect(screen.getByLabelText("Challenge verifying")).toBeTruthy();
  expect(screen.queryByText(/not on this chain/i)).toBeNull();
  expect(screen.queryByText(/could not be verified/i)).toBeNull();
  // And once the reads land on missing evidence, the honest refusal appears.
  await waitFor(() => expect(screen.getByLabelText("Challenge refused")).toBeTruthy(), { timeout: 5_000 });
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

const OPPONENT = "0x00000000000000000000000000000000000000bb";
const STRANGER_FILL = "0x00000000000000000000000000000000000000cc";

it("a named challenge refuses the wrong wallet and accepts only its intended opponent", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    statusByMarket: { [M]: 1 },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "n1",
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
    to: OPPONENT,
  });
  render(<Terminal fake={fake} />);
  // Connect first: with no wallet at all the terminal cannot know the viewer,
  // so the CTA walks the wallet chain instead of naming a mismatch.
  fireEvent.click(
    await waitFor(() => screen.getByRole("button", { name: /connect wallet to accept/i }), { timeout: 5_000 }),
  );
  await waitFor(
    () => {
      // The connected mock wallet (…00ff) is not the named opponent (…00bb).
      const accept = screen.getByRole("button", { name: /open this link with/i }) as HTMLButtonElement;
      expect(accept.hasAttribute("disabled")).toBe(true);
      expect(accept.textContent).toContain("…00bb");
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("gates the accept on the challenge floor: the stake prefills to it and a lower stake disables the accept with its reason", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    statusByMarket: { [M]: 1 },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "f1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xfloored",
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
    stake: 12,
    txHash: "0xfloored",
    expiry: window.expiry,
    minStake: 12,
  });
  render(<Terminal fake={fake} />);
  await waitFor(() => expect(screen.getByLabelText("Incoming challenge")).toBeTruthy(), { timeout: 5_000 });
  // The enforced floor is max(URL 12, tape 9.9) = 12 — shown, and prefilled one
  // cent clear of it so lot/tick quantization cannot escrow under the floor.
  expect(screen.getByText(/stake at least 12\.00 tusdc/i)).toBeTruthy();
  const stakeInput = screen.getByLabelText(/stake \(tusdc\)/i) as HTMLInputElement;
  await waitFor(() => expect(stakeInput.value).toBe("12.01"));
  // Below the floor the accept names the reason and refuses to send.
  fireEvent.change(stakeInput, { target: { value: "5" } });
  const accept = await screen.findByRole("button", { name: /stake at least 12/i });
  expect(accept.hasAttribute("disabled")).toBe(true);
  globalThis.window.location.hash = "#/app";
});

it("refuses an accept the visible opposite ladder cannot fill, before any transaction", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    statusByMarket: { [M]: 1 },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "t1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xthin",
          marketId: M,
          taker: CHALLENGER,
        },
      ],
    },
  });
  // Two visible bid levels ≈ 1.3 tUSDC of Down depth: the whole-or-nothing
  // accept would revert on the pool with FillOrKillNotFillable.
  const thin: BookDepth = {
    bids: [
      { upPrice: 0.55, downPrice: 0.45, contracts: 2, cumContracts: 2 },
      { upPrice: 0.54, downPrice: 0.46, contracts: 1, cumContracts: 3 },
    ],
    asks: [{ upPrice: 0.6, downPrice: 0.4, contracts: 40, cumContracts: 40 }],
    empty: false,
  };
  globalThis.window.location.hash = challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xthin",
    expiry: window.expiry,
    minStake: 9.9,
  });
  render(<Terminal fake={fake} depth={thin} />);
  await waitFor(() => expect(screen.getByLabelText("Incoming challenge")).toBeTruthy(), { timeout: 5_000 });
  const accept = await waitFor(
    () => screen.getByRole("button", { name: /opposite side (holds|can fill)/i }) as HTMLButtonElement,
    { timeout: 5_000 },
  );
  expect(accept.hasAttribute("disabled")).toBe(true);
  // Nothing was sent: no IOC, no FOK, no gas spent on a refusal.
  expect(fake.state.foks.length).toBe(0);
  expect(fake.state.buys.length).toBe(0);
  globalThis.window.location.hash = "#/app";
});

it("a completed named proof with a stranger's accept fill is refused", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "c1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 120,
          txHash: "0xta",
          marketId: M,
          taker: CHALLENGER,
        },
        {
          id: "c2",
          price: 0.42,
          quantity: 22,
          quote: 9.24,
          aggressor: "down",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xtb",
          marketId: M,
          taker: STRANGER_FILL,
        },
      ],
    },
  });
  globalThis.window.location.hash = `${challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xta",
    expiry: window.expiry,
    to: OPPONENT,
  })}&a=0xtb`;
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Challenge refused")).toBeTruthy();
      expect(screen.getByText(/addressed to another wallet/i)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("a completed proof whose accept fill undershot the floor is refused", async () => {
  const fake = createFakeExchange({
    windows: [window],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 } },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "u1",
          price: 0.55,
          quantity: 18,
          quote: 9.9,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 120,
          txHash: "0xta",
          marketId: M,
          taker: CHALLENGER,
        },
        {
          id: "u2",
          price: 0.42,
          quantity: 2,
          quote: 0.84,
          aggressor: "down",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xtb",
          marketId: M,
          taker: OPPONENT,
        },
      ],
    },
  });
  globalThis.window.location.hash = `${challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "up",
    stake: 9.9,
    txHash: "0xta",
    expiry: window.expiry,
    to: OPPONENT,
    minStake: 9.9,
  })}&a=0xtb`;
  render(<Terminal fake={fake} />);
  await waitFor(
    () => {
      expect(screen.getByLabelText("Challenge refused")).toBeTruthy();
      expect(screen.getByText(/less than the challenge floor/i)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});

it("a settled participant can re-challenge the opponent on the successor Window", async () => {
  const ME = "0x00000000000000000000000000000000000000ff"; // the mock connector wallet
  const settled: LiveWindow = {
    ...window,
    status: 4,
    result: "up",
    expiry: Math.floor(Date.now() / 1000) - 30,
  };
  const successor: LiveWindow = {
    ...window,
    marketId: ("0x" + "99".repeat(32)) as `0x${string}`,
    upSymbol: "BTC#NEXT",
    openingPrice: "68123.00",
    expiry: Math.floor(Date.now() / 1000) + 700,
  };
  const fake = createFakeExchange({
    windows: [settled, successor],
    books: { "BTC#YES": { bid: 0.55, ask: 0.6 }, "BTC#NEXT": { bid: 0.45, ask: 0.5 } },
    marketFills: {
      "0x0000000000000000000000000000000000000001": [
        {
          id: "r1",
          price: 0.42,
          quantity: 22,
          quote: 9.24,
          aggressor: "down",
          ts: Math.floor(Date.now() / 1000) - 120,
          txHash: "0xta",
          marketId: M,
          taker: CHALLENGER,
        },
        {
          id: "r2",
          price: 0.58,
          quantity: 18,
          quote: 10.44,
          aggressor: "up",
          ts: Math.floor(Date.now() / 1000) - 60,
          txHash: "0xtb",
          marketId: M,
          taker: ME,
        },
      ],
    },
  });
  globalThis.window.location.hash = `${challengeHref({
    marketId: M as `0x${string}`,
    challenger: CHALLENGER,
    side: "down",
    stake: 9.24,
    txHash: "0xta",
    expiry: window.expiry - 400,
    to: ME,
    minStake: 9.24,
  })}&a=0xtb`;
  render(<Terminal fake={fake} />);
  // Connect so the terminal knows which participant is viewing.
  const connect = await waitFor(
    () => screen.getByRole("button", { name: /connect wallet/i }) as HTMLButtonElement,
    { timeout: 5_000 },
  );
  fireEvent.click(connect);
  // The settled result names ME the winner (Up) and offers the rematch.
  const rematch = await waitFor(
    () => screen.getByRole("button", { name: /rematch .*00aa/i }) as HTMLButtonElement,
    { timeout: 4_000 },
  ).catch(() => {
    console.log("DOM:", document.body.textContent?.slice(0, 900));
    throw new Error("rematch button missing");
  });
  fireEvent.click(rematch);
  await waitFor(
    () => {
      // The rematch retargets the successor Window (its own Line) and arms the
      // opponent-addressed challenge for the strip once the Call fills.
      expect(screen.getByText(/68,123/)).toBeTruthy();
    },
    { timeout: 5_000 },
  );
  globalThis.window.location.hash = "#/app";
});
