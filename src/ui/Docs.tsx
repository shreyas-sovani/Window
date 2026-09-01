import { useEffect } from "react";
import { warmExchange } from "../exchange/somnia";
import { Reveal } from "./kit";
import { Replay } from "./Replay";
import { routeHref, useHashParam } from "./router";

const SECTIONS: { id: string; title: string; body: { h?: string; p?: string }[] }[] = [
  {
    id: "quickstart",
    title: "Quickstart",
    body: [
      { p: "cp .env.example .env && npm install && npm test && npm run dev — then open the printed localhost URL." },
      { p: "The terminal lives at #/app. Everything below assumes an injected wallet (MetaMask or Rabby)." },
    ],
  },
  {
    id: "network",
    title: "Wallet & network",
    body: [
      { h: "Add Shannon" },
      { p: "Chain 50312 · RPC https://api.infra.testnet.somnia.network · symbol STT · explorer shannon-explorer.somnia.network." },
      { h: "Gas" },
      { p: "Get test STT at testnet.somnia.network. Calls also need tUSDC — the terminal's Mint tUSDC button runs the dreamDEX faucet (cap 10,000)." },
      { h: "Collateral" },
      { p: "tUSDC is 6 decimals. The terminal reads decimals from the Window, never a hardcoded scale." },
    ],
  },
  {
    id: "trading",
    title: "Trading a Window",
    body: [
      { h: "The Line" },
      { p: "A Window's opening price. Close at or above the Line resolves Up; below resolves Down." },
      { h: "Calling" },
      { p: "Enter a tUSDC stake. Sizing runs through a live stake quote; the Call is an IOC take at a protective limit — leftovers cancel, nothing rests." },
      { h: "Locking" },
      { p: "Inside the final stretch the clock turns red: new Calls close, Exit stays open until lock." },
      { h: "No book, no Call" },
      { p: "Odds come from the live book. If there is no executable quote, the Call button stays off — Window never sizes an order at an invented 50%." },
      { h: "Exiting" },
      { p: "Exit Up / Exit Down sells that side's outcome tokens back into the book before settlement." },
      { h: "Resting (power users)" },
      { p: "The Book drawer can place a post-only bid. It expires when its Window locks — the pool enforces it — so a Rest can never outlive the market." },
    ],
  },
  {
    id: "duels",
    title: "Duels",
    body: [
      { h: "The loop" },
      { p: "Challenge another wallet on the same Window. Two opposite Calls, two verified fills, one Line, one on-chain winner. Afterward, either caller can repeat their own last verified side on the successor Window." },
      { h: "Opponents, not counterparties" },
      { p: "A duel is social. Each wallet sends its own IOC take; the wallets never fill against each other, no pot is matched, and one invite does not promise the second fill. A duel does not exist until two fills on the same marketId are verified on-chain — a signed tx that did not fill, or a URL field, is never a success state." },
      { h: "Judging" },
      { p: "The challenge link (#/app?d=…) is only a locator: the terminal re-verifies the challenger fill. After the accepting Call verifies, Window appends its exact transaction as &a=… and exposes a completed proof link. Unrelated opposite fills on the public book never become an opponent. The winner is the wallet whose filled side matches settlement; unequal stakes are allowed and shown; a Void is a draw; one fill after expiry is an expired challenge, not a win; the same wallet cannot accept its own challenge." },
      { h: "Replay" },
      { p: "The replay tool below reconstructs one real duel from a marketId and two transaction hashes. It reads the finalized result itself and fails closed if the market is unresolved or a hash is not an owned fill on that market. No real Shannon duel hashes are pinned yet; run one live duel, then share #/docs?m=…&a=…&b=…. Fills and outcomes are never invented to fill the gap." },
    ],
  },
  {
    id: "settling",
    title: "Settlement & claiming",
    body: [
      { p: "Windows resolve on-chain against their oracle question. Winnings never auto-pay — press Claim." },
      { p: "Claim scans the 40 most recently finalized Windows across every venue on the indexer, deduplicated by market. Winners redeem one-to-one minus the venue settlement fee (fetched per held Window); voids redeem both sides at half. The button names unique Windows and expected tUSDC — not a count of outcome tokens." },
      { p: "Every settled Window links its public oracle receipt — the Line-versus-close trail." },
    ],
  },
  {
    id: "pnl",
    title: "P&L",
    body: [
      { p: "The tape signs every fill from your wallet's perspective. Open positions mark to book with average-cost unrealized P&L. All rows link the Shannon explorer." },
    ],
  },
  {
    id: "architecture",
    title: "Architecture",
    body: [
      { p: "Zero custom contracts (ADR-0001). All Event Contract traffic goes through @somnia-chain/markets-sdk ≥ 0.28.1 — the HTTP API is spot-only (ADR-0002)." },
      { p: "The domain layer is pure TypeScript behind an ExchangePort seam with two adapters: Somnia (live) and a deterministic fake the whole test suite runs against (ADR-0003)." },
      { p: "The judge-facing criterion map and evidence checklist live in docs/JUDGING.md. It distinguishes implemented behavior from the still-required live proof, deployment, and recording." },
    ],
  },
  {
    id: "feedback",
    title: "SDK feedback",
    body: [
      { p: "docs/SDK-FEEDBACK.md is our nine-item report back to the dreamDEX team, written while building this terminal." },
    ],
  },
];

export function Docs() {
  const replayRequested = useHashParam("replay");
  const replayMarket = useHashParam("m");
  const replayA = useHashParam("a");
  const replayB = useHashParam("b");
  useEffect(() => {
    warmExchange();
  }, []);
  useEffect(() => {
    if (replayRequested !== "1" && !(replayMarket && replayA && replayB)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("replay-tool")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [replayRequested, replayMarket, replayA, replayB]);
  return (
    <div className="docs">
      <header className="d-mast">
        <a className="l-brand" href={routeHref("landing")}>
          Window
        </a>
        <nav className="l-nav">
          <span className="d-crumb">Docs</span>
          <a href={routeHref("app")}>Terminal</a>
        </nav>
      </header>

      <div className="d-layout">
        <nav className="d-toc" aria-label="Contents">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {s.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => document.getElementById("replay-tool")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Judge replay
          </button>
        </nav>

        <main className="d-body">
          <Reveal>
            <h1 className="d-title">Window Duel, documented.</h1>
            <p className="d-lede">
              Challenge another wallet on the same Window — two opposite Calls, two verified fills, one
              on-chain winner. Everything a trader or a judge needs, one page top to bottom.
            </p>
          </Reveal>
          {SECTIONS.map((s, i) => (
            <Reveal key={s.id} delay={i * 40}>
              <section className="d-section" id={s.id}>
                <h2>{s.title}</h2>
                {s.body.map((b, j) =>
                  b.h ? <h3 key={j}>{b.h}</h3> : <p key={j}>{b.p}</p>,
                )}
              </section>
            </Reveal>
          ))}
          <Reveal key="replay-tool" delay={SECTIONS.length * 40}>
            <section className="d-section" id="replay-tool" aria-label="Judge replay tool">
              <h2>Judge replay</h2>
              <Replay initial={{ marketId: replayMarket ?? "", txA: replayA ?? "", txB: replayB ?? "" }} />
            </section>
          </Reveal>
        </main>
      </div>
    </div>
  );
}
