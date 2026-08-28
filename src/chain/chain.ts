import { defineChain } from "viem";
import { SHANNON } from "./shannon";

export const shannonChain = defineChain({
  id: SHANNON.id,
  name: SHANNON.name,
  nativeCurrency: SHANNON.nativeCurrency,
  rpcUrls: {
    default: {
      http: [...SHANNON.rpcUrls.default.http],
      webSocket: [import.meta.env.VITE_WS_RPC_URL ?? "wss://api.infra.testnet.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: SHANNON.blockExplorers.default,
  },
  testnet: true,
});
