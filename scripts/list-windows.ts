import { isBinaryMarket, SOMNIA_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const ex = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
});

const markets = Object.values(await ex.loadMarkets(true));
const bins = markets.filter((m) => m.type === "binary" && m.active);
console.log("unified binary active", bins.length);
for (const m of bins.slice(0, 12)) {
  const info = isBinaryMarket(m.info) ? m.info : null;
  console.log({
    symbol: m.symbol,
    asset: info?.asset,
    interval: info?.intervalSec,
    expiry: info?.expiry,
    venue: info?.venueId,
    up: m.outcomes?.[0]?.symbol,
  });
}

await Promise.race([
  ex.close(),
  new Promise((_, reject) => setTimeout(() => reject(new Error("close-timeout")), 3_000)),
]).catch(() => {
  /* Shannon WS can keep the process alive after the print; the list already landed. */
});
process.exit(0);
