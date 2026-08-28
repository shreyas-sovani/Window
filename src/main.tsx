import { QueryClientProvider } from "@tanstack/react-query";
import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { queryClient, wagmiConfig } from "./chain/wagmi";
import { getExchange } from "./exchange/somnia";
import { App } from "./ui/App";
import { Docs } from "./ui/Docs";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Landing } from "./ui/Landing";
import { useRoute } from "./ui/router";
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
