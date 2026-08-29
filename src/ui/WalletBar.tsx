import { formatUnits } from "viem";
import { explorerAddress, TUSDC } from "../chain/shannon";
import { DropdownMenu } from "./kit";
import { shorten } from "./format";

/**
 * Account control: balance/P&L summary, compact address trigger, and a dropdown with
 * copy / explorer / disconnect. Trading actions never live in here — the wallet menu
 * is identity and funds only.
 */
export function WalletBar(props: {
  address?: string;
  balance?: bigint;
  copied: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  pnl?: string;
}) {
  if (!props.address) return <span className="acct-none mono">Shannon 50312</span>;
  return (
    <div className="acct-control">
      <div className="acct-summary mono">
        {props.balance !== undefined ? `${formatUnits(props.balance, TUSDC.decimals)} tUSDC` : "—"}
        {props.pnl ? ` · ${props.pnl}` : ""}
      </div>
      <DropdownMenu
        label="Account menu"
        trigger={<span className="mono">{shorten(props.address)}</span>}
        items={[
          { kind: "button", label: props.copied ? "Copied" : "Copy address", icon: "⧉", onSelect: props.onCopy },
          { kind: "link", label: "View on explorer", icon: "↗", href: explorerAddress(props.address) },
          { kind: "button", label: "Disconnect", icon: "⏻", onSelect: props.onDisconnect },
        ]}
      />
    </div>
  );
}
