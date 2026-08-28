/** Somnia Shannon + Event Contract client endpoints from published docs. */

export const SHANNON = {
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://api.infra.testnet.somnia.network",
        "https://dream-rpc.somnia.network",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Shannon", url: "https://shannon-explorer.somnia.network" },
  },
} as const;

export const MAINNET = {
  id: 5031,
  rpc: "https://api.infra.mainnet.somnia.network",
  explorer: "https://explorer.somnia.network",
} as const;

export const TESTNET_INDEXER = "https://dev.smk.somnia.host/v1/graphql";
export const TESTNET_WS = "wss://api.infra.testnet.somnia.network/ws";
export const STT_FAUCET = "https://testnet.somnia.network/";

/** CREATE3 — identical on 5031 and 50312 (dreamDEX contracts-and-addresses). */
export const BINARY_MARKETS_MODULE = "0x3ecC694Cef705358864a646142ac17A90E29e388" as const;

export const TUSDC = {
  address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as const,
  decimals: 6,
  symbol: "tUSDC",
};

export function explorerTx(hash: string): string {
  return `${SHANNON.blockExplorers.default.url}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${SHANNON.blockExplorers.default.url}/address/${addr}`;
}

export function oracleReceipt(oracleQuestionId: string): string {
  return `https://prd.oracle.somnia.host/questions/${oracleQuestionId}?view=graph`;
}
