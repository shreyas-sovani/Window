import { useState } from "react";
import { challengeHref, challengePayloadFromReceipt, challengeableReceipt } from "../domain/challenge-link";
import type { CallReceipt } from "../domain/proof-card";

/**
 * The challenge strip — the USP made clickable. After this session's verified
 * fill it holds the live #/app?d=… as a real link (open, long-press, share from
 * the browser) plus a secondary Copy that writes exactly that URL.
 */
/** Renders the strip only when this session has a verified, still-live Call to challenge from. */
export function ChallengeGate(props: { receipts: CallReceipt[]; address?: string; now: number }) {
  const payload = challengeableReceipt(props.receipts, props.address, props.now);
  const built = payload ? challengePayloadFromReceipt(payload, props.address, props.now) : null;
  if (!built) return null;
  return <ChallengeStrip href={challengeHref(built)} />;
}

export function ChallengeStrip(props: { href: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}${location.pathname}${props.href}`;
  return (
    <section className="challenge-strip" aria-label="Challenge link">
      <div className="kicker">Challenge another wallet</div>
      <a className="mono challenge-url" href={props.href} title="Open the challenge link" aria-label="Open the challenge link">
        {props.href}
      </a>
      <button
        type="button"
        className="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Link copied" : "Copy"}
      </button>
    </section>
  );
}
