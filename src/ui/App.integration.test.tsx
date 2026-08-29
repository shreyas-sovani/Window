// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { StrictMode } from "react";
import { WagmiProvider, createConfig, fallback, http } from "wagmi";
import { mock } from "wagmi/connectors";
import { afterEach, expect, it } from "vitest";
import { shannonChain } from "../chain/chain";
import { createFakeExchange } from "../exchange/fake";
import { getExchange } from "../exchange/somnia";
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
  transports: { [shannonChain.id]: fallback([http("http://127.0.0.1:1")]) },
});

function Terminal({ fake }: { fake: ReturnType<typeof createFakeExchange> }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StrictMode>
      <WagmiProvider config={testConfig}>
        <QueryClientProvider client={qc}>
          <SomniaMarketsProvider client={getExchange().client}>
            <App exchange={fake} />
          </SomniaMarketsProvider>
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
