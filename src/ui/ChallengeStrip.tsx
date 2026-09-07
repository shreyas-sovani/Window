import { useState, type ReactNode } from "react";
import { challengeHref, challengePayloadFromReceipt, challengeableReceipt } from "../domain/challenge-link";
import type { CallReceipt } from "../domain/proof-card";
import { shareLink } from "./share";

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * The challenge strip — the USP made clickable. After this session's verified
 * fill it holds the live #/app?d=… as a real link (open, long-press, share from
 * the browser) plus a secondary Copy that writes exactly that URL. Naming an
 * opponent addresses the link: only that wallet can accept it.
 */
/** Renders the strip only when this session has a verified, still-live Call to challenge from. */
export function ChallengeGate(props: {
  receipts: CallReceipt[];
  address?: string;
  now: number;
  /** Pre-named opponent (rematch); the input starts with it. */
  to?: string;
  /** False while the opposite side of the live Window has no executable depth. */
  allow?: boolean;
}) {
  // A link against a dead opposite book can only ever expire — do not mint it.
  if (props.allow === false) return null;
  const payload = challengeableReceipt(props.receipts, props.address, props.now);
  const built = payload ? challengePayloadFromReceipt(payload, props.address, props.now) : null;
  if (!built) return null;
  return <StripFrom payload={built} to={props.to} />;
}

function StripFrom(props: { payload: ReturnType<typeof challengePayloadFromReceipt>; to?: string }) {
  const [opponent, setOpponent] = useState(props.to ?? "");
  const named = opponent.trim().toLowerCase();
  const to = ADDRESS.test(named) ? named : undefined;
  const href = challengeHref({ ...props.payload!, to });
  return (
    <ChallengeStrip href={href}>
      <label className="challenge-to">
        Opponent wallet
        <input
          className="mono"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="0x… (optional — anyone can accept without it)"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
    </ChallengeStrip>
  );
}

export function ChallengeStrip(props: {
  href: string;
  kicker?: string;
  ariaLabel?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">("idle");
  const url = `${location.origin}${location.pathname}${props.href}`;
  return (
    <section className="challenge-strip" aria-label={props.ariaLabel ?? "Challenge link"}>
      <div className="kicker">{props.kicker ?? "Challenge another wallet"}</div>
      <a
        className="mono challenge-url"
        href={props.href}
        title={props.linkLabel ?? "Open the challenge link"}
        aria-label={props.linkLabel ?? "Open the challenge link"}
      >
        {props.href}
      </a>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          const got = await shareLink(url, "Window Duel challenge");
          setShareState(got === "failed" ? "idle" : got);
          setTimeout(() => setShareState("idle"), 1600);
        }}
      >
        {shareState === "shared" ? "Link shared" : shareState === "copied" ? "Link copied" : "Share"}
      </button>
      {props.children}
    </section>
  );
}
