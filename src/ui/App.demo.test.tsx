// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { custom } from "viem";
import { WagmiProvider, createConfig } from "wagmi";
import { mock } from "wagmi/connectors";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shannonChain } from "../chain/chain";
import { DEMO_WALLET_A, DEMO_WALLET_B } from "../chain/demoWagmi";
import { executeCall, prepareQuotedCall } from "../domain/call-session";
import {
  challengeHref,
  challengePayloadFromReceipt,
  decodeChallengeLink,
} from "../domain/challenge-link";
import { decodeDemoFills, encodeDemoFills } from "../domain/demo-state";
import { callReceiptFromFill, filledCall } from "../domain/filled-call";
import { createDemoExchange } from "../exchange/demo";
import { DEMO_EPOCH_SEC, demoBookFor, demoDepthFor, demoWindowSec } from "../exchange/demo-universe";
import { App } from "./App";

/**
 * Demo mode through the real terminal, wired the way `main.tsx` wires it: the
 * deterministic demo adapter, the simulated wallet, the demo ladder as the odds
 * hook. Proves the recording path — deep book, gate walk, verified fill,
 * self-contained challenge link — without a chain or an indexer.
 */

const CADENCE = 900;

/** Park the clock just inside a demo Window so the Call gate is open. */
function windowStartNear(nowSec: number): number {
  const span = demoWindowSec(CADENCE);
  return DEMO_EPOCH_SEC + Math.floor((nowSec - DEMO_EPOCH_SEC) / span) * span + 5;
}

const offlineConfig = (account: `0x${string}`) =>
  createConfig({
    chains: [shannonChain],
    connectors: [mock({ accounts: [account] })],
    transports: {
      [shannonChain.id]: custom({
        async request({ method }) {
          if (method === "eth_chainId") return `0x${shannonChain.id.toString(16)}`;
          if (method === "eth_getBalance") return "0x0";
          if (method === "eth_call") return `0x${"0".repeat(64)}`;
          if (method === "eth_blockNumber") return "0x1";
          if (method === "eth_getTransactionReceipt") return null;
          throw new Error(`Unhandled offline test RPC: ${method}`);
        },
      }),
    },
  });

function DemoTerminal({
  exchange,
  account = DEMO_WALLET_A,
}: {
  exchange: ReturnType<typeof createDemoExchange>;
  account?: `0x${string}`;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <StrictMode>
      <WagmiProvider config={offlineConfig(account)}>
        <QueryClientProvider client={qc}>
          <App
            exchange={exchange}
            demo
            oddsHook={(input) =>
              input.marketId
                ? { book: demoBookFor({ marketId: input.marketId }), depth: demoDepthFor({ marketId: input.marketId }) }
                : { book: undefined, depth: { bids: [], asks: [], empty: true } }
            }
          />
        </QueryClientProvider>
      </WagmiProvider>
    </StrictMode>
  );
}

beforeEach(() => {
  // Only Date is faked: react-query intervals and waitFor keep real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(windowStartNear(Math.floor(Date.now() / 1000)) * 1000);
  globalThis.window.location.hash = "#/app?demo=1";
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.window.location.hash = "#/app";
  cleanup();
});

it("badges the simulation and grades its own deep book Strong", async () => {
  const exchange = createDemoExchange({ account: DEMO_WALLET_A });
  render(<DemoTerminal exchange={exchange} />);
  await waitFor(() => expect(screen.getByText(/Demo mode — simulated market/)).toBeTruthy(), { timeout: 5_000 });
  expect(screen.getByText("Demo universe")).toBeTruthy();
  // The Book cell reads the same ladder the quotes walk.
  await waitFor(() => expect(screen.getByText("Strong")).toBeTruthy(), { timeout: 5_000 });
  expect(screen.getByTitle(/tUSDC deep/)).toBeTruthy();
});

it("walks the gate to a verified Call and mints a self-contained demo challenge link", async () => {
  const exchange = createDemoExchange({ account: DEMO_WALLET_A });
  render(<DemoTerminal exchange={exchange} />);

  const connect = await waitFor(
    () => screen.getByRole("button", { name: /connect wallet/i }) as HTMLButtonElement,
    { timeout: 5_000 },
  );
  fireEvent.click(connect);

  // Demo mode grants the bounded allowance locally — the mock wallet cannot approve.
  await waitFor(() => expect(screen.getByText("Approve 10.00 tUSDC")).toBeTruthy(), { timeout: 5_000 });
  fireEvent.click(screen.getAllByRole("button", { name: /approve tusdc/i })[0]);

  const callUp = await waitFor(
    () => {
      const btn = screen.getByRole("button", { name: "Call Up" }) as HTMLButtonElement;
      expect(btn.hasAttribute("disabled")).toBe(false);
      return btn;
    },
    { timeout: 5_000 },
  );
  fireEvent.click(callUp);

  // The receipt comes from the demo tape, exactly like the live path.
  await waitFor(() => expect(screen.getByText(/Called UP · filled/)).toBeTruthy(), { timeout: 5_000 });

  const link = await waitFor(
    () => screen.getByRole("link", { name: /open the challenge link/i }) as HTMLAnchorElement,
    { timeout: 5_000 },
  );
  const href = link.getAttribute("href")!;
  // The link is the whole terminal URL: route, challenge hint, demo marker, fills.
  expect(href.startsWith("#/app?d=")).toBe(true);
  expect(href).toContain("&demo=1&s=");
  const hint = decodeChallengeLink(href.match(/[?&]d=([^&]+)/)![1]);
  const fills = decodeDemoFills(href.match(/[?&]s=([^&]+)/)![1]);
  expect(hint).not.toBeNull();
  expect(fills).not.toBeNull();
  // The blob carries this wallet's real fill on the challenged Window.
  expect(fills!.length).toBe(1);
  expect(fills![0].marketId.toLowerCase()).toBe(hint!.marketId.toLowerCase());
  expect(fills![0].taker?.toLowerCase()).toBe(DEMO_WALLET_A.toLowerCase());
  expect(fills![0].txHash).toBe(hint!.txHash);
  expect(hint!.side).toBe("up");
  expect(hint!.minStake).toBeGreaterThan(0);
  // And the invite says how long it stays open.
  expect(screen.getByText(/Invite closes in/)).toBeTruthy();
});

it("plays the whole duel in one browser: the simulated opponent takes the other side", async () => {
  const exchange = createDemoExchange({ account: DEMO_WALLET_A });
  render(<DemoTerminal exchange={exchange} />);

  fireEvent.click(
    await waitFor(() => screen.getByRole("button", { name: /connect wallet/i }), { timeout: 5_000 }),
  );
  await waitFor(() => expect(screen.getByText("Approve 10.00 tUSDC")).toBeTruthy(), { timeout: 5_000 });
  fireEvent.click(screen.getAllByRole("button", { name: /approve tusdc/i })[0]);
  fireEvent.click(
    await waitFor(
      () => {
        const btn = screen.getByRole("button", { name: "Call Up" }) as HTMLButtonElement;
        expect(btn.hasAttribute("disabled")).toBe(false);
        return btn;
      },
      { timeout: 5_000 },
    ),
  );
  await waitFor(() => expect(screen.getByText(/Called UP · filled/)).toBeTruthy(), { timeout: 5_000 });

  fireEvent.click(
    await waitFor(() => screen.getByRole("button", { name: /demo opponent accepts/i }), { timeout: 5_000 }),
  );
  await waitFor(() => expect(screen.getByText(/Demo opponent Called DOWN · filled/)).toBeTruthy(), {
    timeout: 5_000,
  });
  // The duel opens off the tape, and its URL names the accepting transaction.
  await waitFor(() => expect(screen.getByLabelText("Duel open")).toBeTruthy(), { timeout: 5_000 });
  expect(globalThis.window.location.hash).toMatch(/&a=0xdemo/);
  expect(exchange.state.foks.length).toBe(1);
}, 30_000);

it("the opponent's tab verifies that link from the blob alone and accepts on the opposite side", async () => {
  // Wallet A's Call happens at the adapter seam; the link is all wallet B gets.
  const now = Math.floor(Date.now() / 1000);
  const a = createDemoExchange({ account: DEMO_WALLET_A });
  a.actAs(DEMO_WALLET_A);
  const win = (await a.listLiveWindows()).find((w) => w.asset === "BTC" && w.intervalSec === CADENCE)!;
  const quote = await a.quoteStake(win.marketId, "up", 10n * 10n ** 6n);
  const intent = prepareQuotedCall({ live: win, side: "up", nowSec: now, quote });
  const txHash = (await executeCall(a, win, intent))!;
  const filled = filledCall(await a.listFills(DEMO_WALLET_A), {
    side: "up",
    asset: win.asset,
    intervalSec: win.intervalSec,
    txHash,
  })!;
  const payload = challengePayloadFromReceipt(callReceiptFromFill(win, filled, now), DEMO_WALLET_A, now)!;
  const blob = encodeDemoFills(a.exportFillsFor([txHash]));
  globalThis.window.location.hash = `${challengeHref({ ...payload, to: DEMO_WALLET_B })}&demo=1&s=${blob}`;

  // Wallet B opens it in its own tab: a fresh adapter, nothing but the URL.
  const b = createDemoExchange({ account: DEMO_WALLET_B });
  render(<DemoTerminal exchange={b} account={DEMO_WALLET_B} />);
  await waitFor(() => expect(screen.getByLabelText("Incoming challenge")).toBeTruthy(), { timeout: 5_000 });
  expect(screen.getByText(/Called UP/)).toBeTruthy();
  // Addressed link, no wallet yet: the recipient's one action is to connect.
  fireEvent.click(screen.getByRole("button", { name: /connect wallet to accept/i }));
  // The challenge owns the only CTA, so it walks the wallet chain itself.
  fireEvent.click(
    await waitFor(() => screen.getByRole("button", { name: /approve .* to accept/i }), { timeout: 5_000 }),
  );
  const accept = await waitFor(
    () => {
      const btn = screen.getByRole("button", { name: /call down to accept/i }) as HTMLButtonElement;
      expect(btn.hasAttribute("disabled")).toBe(false);
      return btn;
    },
    { timeout: 5_000 },
  );
  fireEvent.click(accept);

  // The accept is a FOK, verified on the demo tape, and only then does the URL
  // publish the accepting transaction as the completed proof.
  await waitFor(() => expect(b.state.foks.length).toBe(1), { timeout: 5_000 });
  await waitFor(
    () => expect(globalThis.window.location.hash).toMatch(/&a=0xdemo/),
    { timeout: 5_000 },
  );
  const hash = globalThis.window.location.hash;
  const carried = decodeDemoFills(hash.match(/[?&]s=([^&]+)/)![1])!;
  // Both legs travel in the completed link, so any browser can replay it.
  expect(carried.length).toBe(2);
  expect(new Set(carried.map((r) => r.aggressor))).toEqual(new Set(["up", "down"]));
  await waitFor(() => expect(screen.getByLabelText("Duel open")).toBeTruthy(), { timeout: 5_000 });
  expect(screen.getByRole("link", { name: /open the verified duel link/i })).toBeTruthy();
}, 30_000);
