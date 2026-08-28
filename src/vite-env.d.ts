/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_RPC_FALLBACK_URL?: string;
  readonly VITE_WS_RPC_URL?: string;
  readonly VITE_INDEXER_URL?: string;
  readonly VITE_VENUE_ID?: string;
  readonly VITE_WC_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
