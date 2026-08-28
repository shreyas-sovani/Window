import { QueryClient } from "@tanstack/react-query";
import { createConfig, fallback, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { shannonChain } from "./chain";
import { SHANNON } from "./shannon";

const rpc = import.meta.env.VITE_RPC_URL ?? SHANNON.rpcUrls.default.http[0];
const fallbackRpc = import.meta.env.VITE_RPC_FALLBACK_URL ?? SHANNON.rpcUrls.default.http[1];

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [shannonChain],
  connectors: [injected()],
  transports: {
    [shannonChain.id]: fallback([http(rpc), http(fallbackRpc)]),
  },
});
