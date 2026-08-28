import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits, type Hex } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { shannonChain } from "../chain/chain";
import { explorerTx, TUSDC } from "../chain/shannon";
import { callSkipCopy, executeCall, executeExit, executeRest, prepareExit, prepareRest, restSkipCopy } from "../domain/call-session";
import { pickWindow } from "../domain/pick-window";
import { pnlCopy, pnlTotals, seriesPnl, seriesPnlCopy } from "../domain/pnl";
import { revertCopy } from "../domain/revert-copy";
import { approveAmount } from "../domain/wallet-gate";
import { totePrimary, totePrimaryCopy } from "../domain/tote-primary";
import { boardNotice } from "../domain/board-notice";
import { readBoard } from "../domain/window-board";
import { bindWallet, somniaExchange } from "../exchange/somnia";
import { CallBoard, type Busy } from "./CallBoard";
import { fmt, shorten } from "./format";
import { PnlStrip } from "./PnlStrip";
import { useLiveOdds } from "./useLiveOdds";
import { WalletBar } from "./WalletBar";

export function App() {
  const qc = useQueryClient();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync, isPending: writing } = useWriteContract();

  const [asset, setAsset] = useState("BTC");
  const [intervalSec, setIntervalSec] = useState(900);
  const [stake, setStake] = useState("10");
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string; txHash?: string } | null>(null);
  const [approveHash, setApproveHash] = useState<Hex>();
  const [approveCooldown, setApproveCooldown] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bindWallet(walletClient);
  }, [walletClient]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!banner || banner.kind !== "ok") return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const windowsQ = useQuery({
    queryKey: ["windows"],
    queryFn: () => somniaExchange.listLiveWindows(),
    refetchInterval: 8_000,
    retry: 1,
  });

  const liveHint = useMemo(
    () => pickWindow(windowsQ.data ?? [], asset, intervalSec, now, import.meta.env.VITE_VENUE_ID || undefined),
    [windowsQ.data, asset, intervalSec, now],
  );

  const posQ = useQuery({
    queryKey: ["pos", address, liveHint?.marketId],
    queryFn: () => {
      const h = liveHint;
      if (!address || !h?.marketId) throw new Error("No live Window for this series.");
      return somniaExchange.outcomeBalances(address, h.marketId);
    },
    enabled: Boolean(address && liveHint?.marketId),
    refetchInterval: 8_000,
  });

  const bookQ = useQuery({
    queryKey: ["book", liveHint?.upSymbol],
    queryFn: () => {
      const h = liveHint;
      if (!h?.upSymbol) throw new Error("No live Window for this series.");
      return somniaExchange.book(h.upSymbol);
    },
    enabled: Boolean(liveHint?.upSymbol),
    refetchInterval: 4_000,
  });

  const historyQ = useQuery({
    queryKey: ["history", asset, intervalSec, liveHint?.venueId],
    queryFn: () => somniaExchange.listSeriesHistory(asset, intervalSec, liveHint?.venueId),
    refetchInterval: 30_000,
  });

  const openQ = useQuery({
    queryKey: ["open", address, liveHint?.upSymbol],
    queryFn: () => somniaExchange.listOpenTickets(liveHint?.upSymbol),
    enabled: Boolean(address && liveHint?.upSymbol),
    refetchInterval: 8_000,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TUSDC.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && liveHint?.pool ? [address, liveHint.pool] : undefined,
    query: { enabled: Boolean(address && liveHint?.pool) },
  });

  const { data: bal } = useReadContract({
    address: TUSDC.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const approveWait = useWaitForTransactionReceipt({ hash: approveHash });
  useEffect(() => {
    if (approveWait.isSuccess && approveHash) {
      setApproveCooldown(true);
      setBanner({ kind: "ok", text: "Approved tUSDC for this Call.", txHash: approveHash });
      void refetchAllowance();
      const t = setTimeout(() => {
        setApproveCooldown(false);
        setApproveHash(undefined);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [approveWait.isSuccess, approveHash, refetchAllowance]);

  const { book, depth } = useLiveOdds({
    pool: liveHint?.pool,
    marketId: liveHint?.marketId,
    decimals: liveHint?.decimals ?? TUSDC.decimals,
    polled: bookQ.data,
  });

  const stakeNum = Number(stake);
  const quoteDecimals = liveHint?.decimals ?? TUSDC.decimals;
  const quoteStakeRaw =
    Number.isFinite(stakeNum) && stakeNum > 0 ? parseUnits(String(stakeNum), quoteDecimals) : 0n;

  const upQuoteQ = useQuery({
    queryKey: ["quote", liveHint?.marketId, "up", quoteStakeRaw.toString()],
    queryFn: () => {
      const h = liveHint;
      if (!h?.marketId) throw new Error("No live Window for this series.");
      return somniaExchange.quoteStake(h.marketId, "up", quoteStakeRaw);
    },
    enabled: Boolean(liveHint?.marketId && quoteStakeRaw > 0n),
    refetchInterval: 4_000,
  });
  const downQuoteQ = useQuery({
    queryKey: ["quote", liveHint?.marketId, "down", quoteStakeRaw.toString()],
    queryFn: () => {
      const h = liveHint;
      if (!h?.marketId) throw new Error("No live Window for this series.");
      return somniaExchange.quoteStake(h.marketId, "down", quoteStakeRaw);
    },
    enabled: Boolean(liveHint?.marketId && quoteStakeRaw > 0n),
    refetchInterval: 4_000,
  });

  const feeQ = useQuery({
    queryKey: ["fees", liveHint?.marketId],
    queryFn: () => {
      const h = liveHint;
      if (!h?.marketId) throw new Error("No live Window for this series.");
      return somniaExchange.settlementFeeBps(h.marketId);
    },
    enabled: Boolean(liveHint?.marketId),
    staleTime: 300_000,
  });

  const fillsQ = useQuery({
    queryKey: ["fills", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return somniaExchange.listFills(address);
    },
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });
  const pnlQ = useQuery({
    queryKey: ["pnl", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return somniaExchange.listPositionPnl(address);
    },
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });
  const claimsQ = useQuery({
    queryKey: ["claims", address, liveHint?.venueId],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return somniaExchange.previewClaimSession(address, liveHint?.venueId);
    },
    enabled: Boolean(address),
    refetchInterval: 60_000,
  });
  const totals = useMemo(
    () => pnlTotals(pnlQ.data ?? [], fillsQ.data ?? []),
    [pnlQ.data, fillsQ.data],
  );
  const seriesTotals = useMemo(
    () => seriesPnl(pnlQ.data ?? [], fillsQ.data ?? [], asset, intervalSec),
    [pnlQ.data, fillsQ.data, asset, intervalSec],
  );

  const board = useMemo(
    () =>
      readBoard({
        windows: windowsQ.data ?? [],
        asset,
        intervalSec,
        nowSec: now,
        venueId: import.meta.env.VITE_VENUE_ID || undefined,
        book,
        upQuote: upQuoteQ.data ?? undefined,
        downQuote: downQuoteQ.data ?? undefined,
        stake: stakeNum,
        connected: isConnected,
        chainId,
        expectedChainId: shannonChain.id,
        allowance: (allowance as bigint | undefined) ?? 0n,
        collateral: bal,
        collateralDecimals: TUSDC.decimals,
      }),
    [
      windowsQ.data,
      asset,
      intervalSec,
      now,
      book,
      upQuoteQ.data,
      downQuoteQ.data,
      stakeNum,
      isConnected,
      chainId,
      allowance,
      bal,
    ],
  );

  const live = board.live;
  const primary = totePrimary({ gate: board.gate, claimable: claimsQ.data ?? 0 });
  const primaryBusy =
    connecting || switching || writing || approveCooldown || approveWait.isLoading || busy !== null;

  async function onPrimary() {
    setBanner(null);
    try {
      if (primary.kind === "claim") {
        await claimAll();
        return;
      }
      if (board.gate.action === "connect") {
        const c = connectors[0];
        if (!c) throw new Error("No injected wallet. Install MetaMask or Rabby.");
        await connectAsync({ connector: c, chainId: shannonChain.id });
        return;
      }
      if (board.gate.action === "switch") {
        await switchChainAsync({ chainId: shannonChain.id });
        return;
      }
      if (board.gate.action === "approve") {
        if (!live) return;
        const amount = approveAmount(board.stakeRaw);
        if (amount === 0n) {
          setBanner({ kind: "err", text: "Enter a stake before approving tUSDC." });
          return;
        }
        const hash = await writeContractAsync({
          address: TUSDC.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [live.pool, amount],
        });
        setApproveHash(hash);
      }
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    }
  }

  const faucet = useMutation({
    mutationFn: () => somniaExchange.mintTestCollateral(),
    onSuccess: () => {
      setBanner({ kind: "ok", text: "Minted up to 10,000 tUSDC." });
      void qc.invalidateQueries();
    },
    onError: (e) => setBanner({ kind: "err", text: revertCopy(e) }),
  });

  async function callSide(side: "up" | "down") {
    const win = live;
    if (!win || !board.gate.canCall) return;
    const intent = side === "up" ? board.upPlan : board.downPlan;
    if (!intent.ok) {
      setBanner({ kind: "err", text: callSkipCopy(intent.reason) });
      return;
    }
    if (board.shortCollateral) {
      setBanner({ kind: "err", text: "Not enough tUSDC in this wallet." });
      return;
    }
    setBusy(side);
    setBanner(null);
    try {
      const txHash = await executeCall(somniaExchange, win, intent);
      setBanner({
        kind: "ok",
        text: `Called ${side.toUpperCase()} · ${fmt(intent.plan.contracts, 3)} contracts`,
        txHash,
      });
      void posQ.refetch().then(() => {
        void qc.invalidateQueries({ queryKey: ["fills"] });
        void qc.invalidateQueries({ queryKey: ["pnl"] });
      });
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    } finally {
      setBusy(null);
    }
  }

  async function exitSide(side: "up" | "down") {
    const win = live;
    const holdings = posQ.data;
    if (!win || !holdings) return;
    const intent = prepareExit({
      live: win,
      book,
      side,
      up: holdings.up,
      down: holdings.down,
      decimals: holdings.decimals,
    });
    if (!intent.ok) {
      setBanner({ kind: "err", text: "Nothing to exit on that side." });
      return;
    }
    setBusy(side === "up" ? "exit-up" : "exit-down");
    setBanner(null);
    try {
      const txHash = await executeExit(somniaExchange, win, intent);
      setBanner({ kind: "ok", text: `Exited ${side.toUpperCase()}`, txHash });
      void posQ.refetch().then(() => {
        void qc.invalidateQueries({ queryKey: ["fills"] });
        void qc.invalidateQueries({ queryKey: ["pnl"] });
      });
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    } finally {
      setBusy(null);
    }
  }

  async function claimAll() {
    if (!address) return;
    setBusy("claim");
    setBanner(null);
    try {
      const n = await somniaExchange.claimFinalized(address, live?.venueId);
      setBanner({
        kind: "ok",
        text: n ? `Claimed ${n} outcome balance(s).` : "Nothing to claim on recent Finalized Windows.",
      });
      void qc.invalidateQueries({ queryKey: ["fills"] });
      void qc.invalidateQueries({ queryKey: ["pnl"] });
      void qc.invalidateQueries({ queryKey: ["claims"] });
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    } finally {
      setBusy(null);
    }
  }

  async function restSide(side: "up" | "down") {
    const win = live;
    if (!win || !board.gate.canCall) return;
    const intent = prepareRest({ live: win, book, stake: stakeNum, side, nowSec: now });
    if (!intent.ok) {
      setBanner({ kind: "err", text: restSkipCopy(intent.reason) });
      return;
    }
    if (board.shortCollateral) {
      setBanner({ kind: "err", text: "Not enough tUSDC in this wallet." });
      return;
    }
    setBusy(side === "up" ? "rest-up" : "rest-down");
    setBanner(null);
    try {
      const txHash = await executeRest(somniaExchange, win, intent);
      setBanner({
        kind: "ok",
        text: `Resting ${side.toUpperCase()} · ${fmt(intent.plan.contracts, 3)} @ ${fmt(intent.plan.price * 100, 1)}%`,
        txHash,
      });
      void openQ.refetch();
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    } finally {
      setBusy(null);
    }
  }

  async function cancelTicket(id: string, symbol: string) {
    setBusy("cancel");
    setBanner(null);
    try {
      await somniaExchange.cancelOpenTicket(id, symbol);
      setBanner({ kind: "ok", text: "Cancelled resting order. Escrow returns to this wallet." });
      void openQ.refetch();
    } catch (e) {
      setBanner({ kind: "err", text: revertCopy(e) });
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setBanner({ kind: "err", text: "Could not copy the address." });
    }
  }

  const loadErr = windowsQ.error ? revertCopy(windowsQ.error) : null;
  const notice = boardNotice({
    loadError: loadErr,
    loading: windowsQ.isLoading,
    live: Boolean(live),
    thinBook: board.thinBook,
    shortCollateral: board.shortCollateral,
  });

  return (
    <div className="app">
      <header className="mast">
        <div>
          <div className="wordmark">Window</div>
          <p>Call the next interval. The Line is the open.</p>
          <div className={`status${windowsQ.isSuccess ? "" : " sync"}`}>
            <span className="dot" aria-hidden />
            {windowsQ.isSuccess ? "Indexer live" : "Syncing…"}
          </div>
        </div>
        <div className="acct mono">
          <WalletBar
            address={address}
            balance={bal}
            copied={copied}
            onCopy={() => void copyAddress()}
            onDisconnect={() => disconnect()}
            pnl={address ? pnlCopy(totals) : undefined}
          />
        </div>
      </header>

      <CallBoard
        board={board}
        asset={asset}
        intervalSec={intervalSec}
        now={now}
        stake={stake}
        onAsset={(nextAsset, nextInterval) => {
          setAsset(nextAsset);
          setIntervalSec(nextInterval);
        }}
        onStake={setStake}
        loading={windowsQ.isLoading}
        history={historyQ.data}
        seriesPnl={address ? seriesPnlCopy(seriesTotals, asset, intervalSec) : undefined}
        holdings={posQ.data}
        tickets={openQ.data}
        address={address}
        busy={busy}
        primaryBusy={primaryBusy}
        primaryLabel={totePrimaryCopy(
          primary,
          {
            connecting,
            switching,
            approving: writing || approveWait.isLoading || approveCooldown,
            claiming: busy === "claim",
          },
          board.phase,
        )}
        showPrimary={primary.kind !== "call"}
        claimDue={primary.kind === "claim"}
        faucetEnabled={isConnected && chainId === shannonChain.id}
        onPrimary={() => void onPrimary()}
        onCall={(side) => void callSide(side)}
        onExit={(side) => void exitSide(side)}
        onClaim={() => void claimAll()}
        onFaucet={() => {
          setBusy("faucet");
          faucet.mutate(undefined, { onSettled: () => setBusy(null) });
        }}
        onCancel={(id, symbol) => void cancelTicket(id, symbol)}
        onRest={(side) => void restSide(side)}
        depth={depth}
        feeBps={feeQ.data}
      />

      {address && <PnlStrip fills={fillsQ.data} positions={pnlQ.data} />}

      <aside className="toasts" aria-live="polite">
        {banner && (
          <div className={`banner ${banner.kind === "err" ? "err" : ""}`}>
            {banner.text}
            {banner.txHash && (
              <>
                {" · "}
                <a href={explorerTx(banner.txHash)} target="_blank" rel="noreferrer" className="mono">
                  {shorten(banner.txHash)}
                </a>
              </>
            )}
          </div>
        )}
      </aside>
      {notice && (
        <div className={`banner ${notice.kind === "err" ? "err" : ""}`}>
          {notice.text}
          {notice.action === "Retry" && (
            <button className="ghost" type="button" onClick={() => void windowsQ.refetch()}>
              Retry
            </button>
          )}
          {notice.action === "Mint tUSDC" && isConnected && chainId === shannonChain.id && (
            <button
              className="ghost"
              type="button"
              disabled={busy !== null}
              onClick={() => {
                setBusy("faucet");
                faucet.mutate(undefined, { onSettled: () => setBusy(null) });
              }}
            >
              Mint tUSDC
            </button>
          )}
        </div>
      )}

      <footer className="foot">
        Prototype on Somnia Shannon. Event Contracts via @somnia-chain/markets-sdk ≥ 0.28.1. No custom
        contracts. Default Call is IOC — leftovers do not rest. Rest quotes live in the Book drawer.{" "}
        <a href="https://docs.dreamdex.io/developers/event-contracts" target="_blank" rel="noreferrer">
          Developer docs
        </a>
      </footer>
    </div>
  );
}
