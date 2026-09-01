import { useEffect } from "react";
import { warmExchange } from "../exchange/somnia";
import { Badge, Button, Reveal } from "./kit";
import { routeHref } from "./router";

/** Warm the SDK's market hydration while the visitor reads — the terminal opens warm. */
export function WarmExchange() {
  useEffect(() => {
    warmExchange();
  }, []);
  return null;
}

/** Hero SVG: two independently verified fills resolving against one Window. */
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 720 420" fill="none" aria-hidden="true">
      <rect x="34" y="54" width="270" height="126" rx="14" fill="var(--card)" stroke="var(--rule-strong)" />
      <text x="58" y="86" className="hero-art-label">WALLET A · VERIFIED FILL</text>
      <text x="58" y="128" className="hero-art-time hero-art-up">CALL UP</text>
      <text x="58" y="158" className="hero-art-label">18.00 @ 55% · 0x…A91C</text>
      <rect x="416" y="54" width="270" height="126" rx="14" fill="var(--card)" stroke="var(--rule-strong)" />
      <text x="440" y="86" className="hero-art-label">WALLET B · VERIFIED FILL</text>
      <text x="440" y="128" className="hero-art-time hero-art-down">CALL DOWN</text>
      <text x="440" y="158" className="hero-art-label">22.00 @ 42% · 0x…7B02</text>
      <path className="draw" d="M169 180 L310 250" stroke="var(--up)" strokeWidth="2" />
      <path className="draw" d="M551 180 L410 250" stroke="var(--down)" strokeWidth="2" />
      <line x1="42" y1="276" x2="678" y2="276" stroke="var(--rule-strong)" strokeDasharray="5 7" />
      <rect x="245" y="222" width="230" height="130" rx="16" fill="var(--paper)" stroke="var(--clay)" strokeWidth="2" />
      <text x="360" y="252" textAnchor="middle" className="hero-art-label">FINALIZED ON SHANNON</text>
      <text x="360" y="302" textAnchor="middle" className="hero-art-time hero-art-up">UP WINS</text>
      <text x="360" y="330" textAnchor="middle" className="hero-art-label">LINE · 67,214.50 · TAPE AGREES</text>
      <g>
        <circle cx="56" cy="386" r="5" fill="var(--up)" />
        <text x="72" y="391" className="hero-art-sub">TWO FILLS · ONE MARKET · ZERO REFEREES</text>
      </g>
    </svg>
  );
}

export function Landing() {
  return (
    <div className="landing">
      <WarmExchange />
      <header className="l-mast">
        <span className="l-brand">Window</span>
        <nav className="l-nav">
          <a href={routeHref("docs")}>Docs</a>
          <a href={routeHref("app")}>Terminal</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="kicker">The social layer for dreamDEX Event Contracts</div>
          <h1>
            Make the Call.<br />
            Prove who won.
          </h1>
          <p>
            Turn a filled Up/Down trade into a wallet challenge you can drop into any group chat. Two opposite
            fills on one Window; the public tape and finalized market decide the result.
          </p>
          <div className="hero-cta">
            <Button variant="primary" href={routeHref("app")}>
              Open a live Window
            </Button>
            <Button variant="ghost" href={`${routeHref("docs")}?replay=1`}>
              Verify a duel
            </Button>
          </div>
        </div>
        <div className="hero-visual">
          <HeroArt />
        </div>
      </section>

      <main className="l-body">
        <Reveal>
          <section className="l-section">
            <h2>One market take becomes a social challenge.</h2>
            <p>
              Call a side, then share the proof link. The recipient sees your verified fill and one next action:
              take the opposite side of that exact Window. The duel exists only after both fills appear on the
              public tape; a submitted-but-unfilled transaction earns no receipt and no victory screen.
            </p>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="l-section">
            <h2>No referee. No custody. No new contract.</h2>
            <p>
              Window reads dreamDEX’s existing market, fill tape, and final settlement on Somnia. Each opponent
              independently takes the book—there is no matched pot and the wallets are not counterparties. The
              replay fails closed when a market, wallet, side, or transaction proof does not agree.
            </p>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="l-section l-steps">
            <h2>Three beats. Every claim is inspectable.</h2>
            <ol>
              <li>
                <Badge tone="clay">1</Badge>
                Call — choose Up or Down with bounded risk and an IOC limit.
              </li>
              <li>
                <Badge tone="clay">2</Badge>
                Challenge — share the verified fill; another wallet takes the opposite side.
              </li>
              <li>
                <Badge tone="clay">3</Badge>
                Prove — both transactions and the finalized winner resolve from chain data.
              </li>
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="l-cta">
            <h2>The next Window is already open.</h2>
            <Button variant="primary" href={routeHref("app")}>
              Call it
            </Button>
          </section>
        </Reveal>
      </main>

      <footer className="l-foot">
        <span>Window · dreamDEX Event Contracts · Somnia Shannon testnet</span>
        <a href="https://docs.dreamdex.io/developers/event-contracts" target="_blank" rel="noreferrer">
          Developer docs
        </a>
      </footer>
    </div>
  );
}
