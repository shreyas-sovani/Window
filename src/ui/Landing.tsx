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

/** Hero SVG: the terminal as a line drawing — clock, line, and a drawn price path. */
function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 720 420" fill="none" aria-hidden="true">
      <line className="draw" x1="40" y1="250" x2="680" y2="250" stroke="var(--rule-strong)" strokeWidth="1" strokeDasharray="4 6" />
      <path
        className="draw path-price"
        d="M40,250 C80,240 100,190 140,196 S210,150 250,168 S320,110 360,128 S430,90 470,104 S540,70 580,84 S660,50 680,58"
        stroke="var(--clay)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="680" cy="58" r="6" fill="var(--clay)" />
      <circle cx="680" cy="58" r="12" stroke="var(--clay)" strokeWidth="1.5" opacity="0.4" />
      <text x="40" y="292" className="hero-art-label">LINE · 67,214.50</text>
      <text x="470" y="42" className="hero-art-label hero-art-now">NOW</text>
      <g className="hero-art-clock">
        <text x="360" y="370" textAnchor="middle" className="hero-art-time">09:41</text>
        <text x="360" y="394" textAnchor="middle" className="hero-art-sub">UNTIL LOCK</text>
      </g>
      <g>
        <rect x="470" y="300" width="14" height="52" rx="3" fill="var(--up)" opacity="0.75" />
        <rect x="494" y="316" width="14" height="36" rx="3" fill="var(--down)" opacity="0.75" />
        <rect x="518" y="290" width="14" height="62" rx="3" fill="var(--up)" opacity="0.75" />
        <rect x="542" y="326" width="14" height="26" rx="3" fill="var(--down)" opacity="0.75" />
        <rect x="566" y="282" width="14" height="70" rx="3" fill="var(--up)" opacity="0.75" />
        <rect x="590" y="306" width="14" height="46" rx="3" fill="var(--down)" opacity="0.75" />
        <rect x="614" y="274" width="14" height="78" rx="3" fill="var(--up)" opacity="0.75" />
        <rect x="638" y="298" width="14" height="54" rx="3" fill="var(--up)" opacity="0.75" />
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
          <h1>
            Challenge another wallet<br />
            on the same Window.
          </h1>
          <p>
            Two opposite Calls, two verified fills, one Line, one on-chain winner — dreamDEX Event Contracts
            on Somnia. You are social opponents, never exchange counterparties.
          </p>
          <div className="hero-cta">
            <Button variant="primary" href={routeHref("app")}>
              Open the terminal
            </Button>
            <Button variant="ghost" href={routeHref("docs")}>
              Read the docs
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
            <h2>Call, challenge, settle.</h2>
            <p>
              Call a side and share the challenge link. The other wallet Calls the opposite side of the same
              Window — one invite can create two trades, and the chain verifies both fills. Settlement names
              the winner; the loser gets the rematch on the next Window.
            </p>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="l-section">
            <h2>Settled by the chain, not by us.</h2>
            <p>
              Every Window resolves against its oracle receipt on Somnia — the winner is simply the wallet whose
              filled side matches settlement. Opponents never fill against each other and no pot is matched: each
              Call is its own book take. A solo Call still works whenever you want the market to yourself.
            </p>
          </section>
        </Reveal>

        <Reveal delay={80}>
          <section className="l-section l-steps">
            <h2>How a Window works</h2>
            <ol>
              <li>
                <Badge tone="clay">1</Badge>
                The Window opens — the Line is its opening price.
              </li>
              <li>
                <Badge tone="clay">2</Badge>
                It locks — the countdown hits zero, trading stops.
              </li>
              <li>
                <Badge tone="clay">3</Badge>
                It settles — close versus Line resolves on-chain. Claim your payout.
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
