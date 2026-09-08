import { fallback, http, createConfig } from "wagmi";
import { mock } from "wagmi/connectors";
import { shannonChain } from "./chain";
import { envUrl, SHANNON } from "./shannon";

/**
 * The simulated wallet demo mode auto-connects. Two stable identities so a
 * shared demo duel has a challenger and an opponent; a tab keeps its identity
 * for the session, and a tab opening a link whose challenger is Wallet A takes
 * Wallet B (opening your own link stays you — self-accept is refused honestly).
 */
export const DEMO_WALLET_A = "0x00000000000000000000000000000000000000aa" as const;
export const DEMO_WALLET_B = "0x00000000000000000000000000000000000000bb" as const;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function demoAccountFor(challenger?: string | null): `0x${string}` {
  const stored = sessionStorage.getItem("demoWallet");
  if (stored && ADDRESS.test(stored)) return stored as `0x${string}`;
  const want =
    challenger &&
    challenger.toLowerCase() === (DEMO_WALLET_A as string).toLowerCase()
      ? DEMO_WALLET_B
      : DEMO_WALLET_A;
  sessionStorage.setItem("demoWallet", want);
  return want as `0x${string}`;
}

const configs = new Map<string, ReturnType<typeof build>>();

function build(account: `0x${string}`) {
  return createConfig({
    chains: [shannonChain],
    connectors: [mock({ accounts: [account] })],
    transports: {
      [shannonChain.id]: fallback([
        http(envUrl(import.meta.env.VITE_RPC_URL, SHANNON.rpcUrls.default.http[0])),
        http(envUrl(import.meta.env.VITE_RPC_FALLBACK_URL, SHANNON.rpcUrls.default.http[1])),
      ]),
    },
  });
}

export function demoWagmiConfig(account: `0x${string}`) {
  let config = configs.get(account);
  if (!config) {
    config = build(account);
    configs.set(account, config);
  }
  return config;
}
