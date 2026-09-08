import { QueryClientProvider } from "@tanstack/react-query";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { demoAccountFor, demoWagmiConfig } from "./chain/demoWagmi";
import { queryClient, wagmiConfig } from "./chain/wagmi";
import { getExchange } from "./exchange/somnia";
import { demoExchangeFor } from "./exchange/demo";
import { demoBookFor, demoDepthFor } from "./exchange/demo-universe";
import { decodeChallengeLink } from "./domain/challenge-link";
import { App } from "./ui/App";
import { Docs } from "./ui/Docs";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Landing } from "./ui/Landing";
import { bootstrapSearchLink, hashParam, useRoute } from "./ui/router";
import "./ui/styles.css";

// A shared link whose fragment was stripped in transit still carries its proof
// in the query string. Lift it into the terminal hash before the first render.
const lifted = bootstrapSearchLink(window.location.search, window.location.hash);
if (lifted) window.history.replaceState(null, "", `${window.location.pathname}${lifted}`);

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
    const demoExchange = demoExchangeFor(account);
    // The SDK odds hook needs the SDK provider; demo reads the demo ladder —
    // the same book its quotes walk, so health, drawer, and ticket agree.
    const useDemoOdds = (input: {
      marketId?: string;
      decimals: number;
      polled?: import("./exchange/port").BookTop;
    }): { book: import("./exchange/port").BookTop | undefined; depth: import("./domain/book-depth").BookDepth } => {
      if (!input.marketId) return { book: input.polled, depth: { bids: [], asks: [], empty: true } };
      const depth = demoDepthFor({ marketId: input.marketId });
      return { book: demoBookFor({ marketId: input.marketId }), depth };
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
