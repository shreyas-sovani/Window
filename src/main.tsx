import { QueryClientProvider } from "@tanstack/react-query";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { queryClient, wagmiConfig } from "./chain/wagmi";
import { getExchange } from "./exchange/somnia";
import { App } from "./ui/App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./ui/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SomniaMarketsProvider client={getExchange().client}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </SomniaMarketsProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
