import { QueryClientProvider } from "@tanstack/react-query";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { demoAccountFor, demoWagmiConfig } from "./chain/demoWagmi";
import { queryClient, wagmiConfig } from "./chain/wagmi";
import { getExchange } from "./exchange/somnia";
import { createDemoExchange } from "./exchange/demo";
import { decodeChallengeLink } from "./domain/challenge-link";
import { App } from "./ui/App";
import { Docs } from "./ui/Docs";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Landing } from "./ui/Landing";
import { hashParam, useRoute } from "./ui/router";
import "./ui/styles.css";

function Root() {
  const [route] = useRoute();
  if (route === "landing") {
    return (
      <ErrorBoundary>
        <Landing />
      </ErrorBoundary>
    );
  }
  if (route === "docs") {
    return (
      <ErrorBoundary>
        <Docs />
      </ErrorBoundary>
    );
  }
  const demoRaw = hashParam(location.hash, "demo");
  if (demoRaw !== null) {
    // Demo mode: the real product on the deterministic demo adapter, a
    // simulated wallet, and no SDK live store. Every screen is badged.
    const challenger = decodeChallengeLink(hashParam(location.hash, "d"))?.challenger;
    const account = demoAccountFor(challenger);
    const demoExchange = createDemoExchange({ account });
    // The SDK odds hook needs the SDK provider; demo reads the demo book.
    const useDemoOdds = (input: {
      marketId?: string;
      decimals: number;
      polled?: import("./exchange/port").BookTop;
    }): { book: import("./exchange/port").BookTop | undefined; depth: import("./domain/book-depth").BookDepth } => {
      const w = input.marketId
        ? demoExchange.state.windows.find((x) => x.marketId.toLowerCase() === input.marketId!.toLowerCase())
        : undefined;
      const top = w ? demoExchange.state.books[w.upSymbol] : undefined;
      const book: import("./exchange/port").BookTop | undefined =
        top?.bid !== undefined || top?.ask !== undefined ? { bid: top?.bid, ask: top?.ask } : input.polled;
      return { book, depth: { bids: [], asks: [], empty: true } };
    };
    return (
      <WagmiProvider config={demoWagmiConfig(account)}>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <App exchange={demoExchange} demo oddsHook={useDemoOdds} />
          </ErrorBoundary>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SomniaMarketsProvider client={getExchange().client}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </SomniaMarketsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
