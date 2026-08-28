import { formatUnits } from "viem";
import { explorerAddress, TUSDC } from "../chain/shannon";
import { shorten } from "./format";

export function WalletBar(props: {
  address?: string;
  balance?: bigint;
  copied: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  pnl?: string;
}) {
  if (!props.address) return <span>Shannon 50312</span>;
  return (
    <>
      <a href={explorerAddress(props.address)} target="_blank" rel="noreferrer">
        {shorten(props.address)}
      </a>
      <button className="ghost" type="button" onClick={props.onCopy} style={{ marginTop: 8 }}>
        {props.copied ? "Copied" : "Copy address"}
      </button>
      <div>{props.balance !== undefined ? `${formatUnits(props.balance, TUSDC.decimals)} tUSDC` : "—"}</div>
      {props.pnl && <div className="pnl">{props.pnl}</div>}
      <button className="ghost" type="button" onClick={props.onDisconnect} style={{ marginTop: 8 }}>
        Disconnect
      </button>
    </>
  );
}
