import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi, parseUnits, type Hex } from "viem";
import {
  useAccount,
  useBalance,
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
import { autoSeries } from "../domain/auto-series";
import { chipStatus, nextStep } from "../domain/onboarding";
import { callSkipCopy, executeCall, executeExit, executeRest, prepareExit, prepareRest, restSkipCopy } from "../domain/call-session";
import { pickWindow } from "../domain/pick-window";
import { pnlCopy, pnlTotals, seriesPnl, seriesPnlCopy } from "../domain/pnl";
import { revertCopy } from "../domain/revert-copy";
import { approveAmount } from "../domain/wallet-gate";
import { totePrimary, totePrimaryCopy } from "../domain/tote-primary";
import { boardNotice } from "../domain/board-notice";
import { claimReceiptCopy, claimSessionCopy } from "../domain/claim-session";
import type { CallReceipt } from "../domain/proof-card";
import { readBoard } from "../domain/window-board";
import { bindWallet, somniaExchange } from "../exchange/somnia";
import type { ExchangePort } from "../exchange/port";
import { CallBoard } from "./CallBoard";
import { fmt, shorten } from "./format";
import { useBanner, useNow, usePulseSamples } from "./hooks";
import { PnlStrip } from "./PnlStrip";
import { Pulse } from "./Pulse";
import { ReceiptStrip } from "./ReceiptStrip";
import { useLiveOdds } from "./useLiveOdds";
import { useWriteGuard } from "./write-guard";
import { WalletBar } from "./WalletBar";

/** The terminal. `exchange` is injectable so integration tests run the real UI against the fake adapter. */
export function App({ exchange = somniaExchange }: { exchange?: ExchangePort }) {
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
  const now = useNow();
  const [banner, setBanner] = useBanner();
  const [approveHash, setApproveHash] = useState<Hex>();
  const [approveCooldown, setApproveCooldown] = useState(false);
  const { busy, run } = useWriteGuard((held) => {
    setBanner({ kind: "err", text: `One wallet action at a time — ${held} is still running.` });
  });
  const [copied, setCopied] = useState(false);
  const [receipts, setReceipts] = useState<CallReceipt[]>([]);

  useEffect(() => {
    bindWallet(walletClient);
  }, [walletClient]);

  const windowsQ = useQuery({
    queryKey: ["windows"],
    queryFn: () => exchange.listLiveWindows(),
    refetchInterval: 8_000,
    retry: 1,
  });

  const liveHint = useMemo(
    () => pickWindow(windowsQ.data ?? [], asset, intervalSec, now, import.meta.env.VITE_VENUE_ID || undefined),
    [windowsQ.data, asset, intervalSec, now],
  );

  // Opportunity-first: when the selected series has no Trading Window, jump to the
  // best one (Line + safe headroom). One attempt per target so it never fights the roll.
  const autoTried = useRef("");
  useEffect(() => {
    if (!windowsQ.data || windowsQ.data.length === 0) return;
    if (liveHint && liveHint.status === 1 && liveHint.openingPrice) return;
    const best = autoSeries(windowsQ.data, now);
    if (!best) return;
    if (best.asset === asset && best.intervalSec === intervalSec) return;
    const key = `${best.asset}:${best.intervalSec}`;
    if (autoTried.current === key) return;
    autoTried.current = key;
    setAsset(best.asset);
    setIntervalSec(best.intervalSec);
  }, [windowsQ.data, liveHint?.status, liveHint?.marketId, liveHint?.openingPrice, asset, intervalSec, now]);

  const posQ = useQuery({
    queryKey: ["pos", address, liveHint?.marketId],
    queryFn: () => {
      const h = liveHint;
      if (!address || !h?.marketId) throw new Error("No live Window for this series.");
      return exchange.outcomeBalances(address, h.marketId);
    },
    enabled: Boolean(address && liveHint?.marketId),
    refetchInterval: 8_000,
  });

  const bookQ = useQuery({
    queryKey: ["book", liveHint?.upSymbol],
    queryFn: () => {
      const h = liveHint;
      if (!h?.upSymbol) throw new Error("No live Window for this series.");
      return exchange.book(h.upSymbol);
    },
    enabled: Boolean(liveHint?.upSymbol),
    refetchInterval: 4_000,
  });

  const historyQ = useQuery({
    queryKey: ["history", asset, intervalSec, liveHint?.venueId],
    queryFn: () => exchange.listSeriesHistory(asset, intervalSec, liveHint?.venueId),
    refetchInterval: 30_000,
  });

  const openQ = useQuery({
    queryKey: ["open", address, liveHint?.upSymbol],
    queryFn: () => exchange.listOpenTickets(liveHint?.upSymbol),
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
  useEffect(() => {
    if (approveWait.isError && approveHash) {
      setApproveHash(undefined);
      setBanner({
        kind: "err",
        text: "The approve transaction failed or was replaced. Nothing was approved — try again.",
        txHash: approveHash,
      });
    }
  }, [approveWait.isError, approveHash]);

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
      return exchange.quoteStake(h.marketId, "up", quoteStakeRaw);
    },
    enabled: Boolean(liveHint?.marketId && quoteStakeRaw > 0n),
    refetchInterval: 4_000,
  });
  const downQuoteQ = useQuery({
    queryKey: ["quote", liveHint?.marketId, "down", quoteStakeRaw.toString()],
    queryFn: () => {
      const h = liveHint;
      if (!h?.marketId) throw new Error("No live Window for this series.");
      return exchange.quoteStake(h.marketId, "down", quoteStakeRaw);
    },
    enabled: Boolean(liveHint?.marketId && quoteStakeRaw > 0n),
    refetchInterval: 4_000,
  });

  const feeQ = useQuery({
    queryKey: ["fees", liveHint?.marketId],
    queryFn: () => {
      const h = liveHint;
      if (!h?.marketId) throw new Error("No live Window for this series.");
      return exchange.settlementFeeBps(h.marketId);
    },
    enabled: Boolean(liveHint?.marketId),
    staleTime: 300_000,
  });

  const fillsQ = useQuery({
    queryKey: ["fills", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return exchange.listFills(address);
    },
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });
  const pnlQ = useQuery({
    queryKey: ["pnl", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return exchange.listPositionPnl(address);
    },
    enabled: Boolean(address),
    refetchInterval: 15_000,
  });
  const claimsQ = useQuery({
    queryKey: ["claims", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected.");
      return exchange.previewClaimSession(address);
    },
    enabled: Boolean(address),
    refetchInterval: 60_000,
  });
  const marketFillsQ = useQuery({
    queryKey: ["mtape", liveHint?.marketId],
    queryFn: () => {
      const h = liveHint;
      if (!h?.pool) throw new Error("No live Window for this series.");
      return exchange.listMarketFills(h.pool, h.decimals);
    },
    enabled: Boolean(liveHint?.marketId),
    refetchInterval: 6_000,
  });
  const priceQ = useQuery({
    queryKey: ["price", asset],
    queryFn: () => exchange.assetPrice(asset),
    refetchInterval: 2_000,
  });
  useEffect(() => {
    void exchange.watchAssetPrice(asset);
  }, [asset]);
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
  const claims = claimsQ.data ?? { count: 0, windows: 0, payout: 0n };
  const primary = totePrimary({ gate: board.gate, claimable: claims.windows, payout: claims.payout });
  const primaryBusy =
    connecting || switching || writing || approveCooldown || approveWait.isLoading || busy !== null;

  const sttBal = useBalance({ address });
  const hasGas = sttBal.data === undefined ? undefined : sttBal.data.value > 0n;
  const step = useMemo(
    () =>
      nextStep(
        {
          connected: isConnected,
          chainId,
          expectedChainId: shannonChain.id,
          hasGas,
          collateral: bal,
          stakeRaw: board.stakeRaw,
          allowance: (allowance as bigint | undefined) ?? 0n,
          callable: Boolean(live) && board.upPlan.ok,
          claimable: claims.windows,
        },
        live?.decimals ?? TUSDC.decimals,
      ),
    [isConnected, chainId, hasGas, bal, board.stakeRaw, board.upPlan.ok, allowance, live, claims.windows],
  );

  const { impliedSamples, priceSamples } = usePulseSamples({
    seriesKey: `${asset}:${intervalSec}`,
    implied: board.implied,
    price: priceQ.data,
    now,
  });

  const CADENCE_KEYS = [300, 900, 3600, 14400, 86400];
  const cadenceStates = useMemo(() => {
    const out: Record<string, "trading" | "waiting" | "none"> = {};
    for (const c of CADENCE_KEYS) {
      out[String(c)] = chipStatus(windowsQ.data ?? [], asset, c, now);
    }
    return out;
  }, [windowsQ.data, asset, now]);

  async function onPrimary() {
    setBanner(null);
    if (primary.kind === "claim") {
      await claimAll();
      return;
    }
    const kind =
      board.gate.action === "connect"
        ? ("connect" as const)
        : board.gate.action === "switch"
          ? ("switch" as const)
          : ("approve" as const);
    await run(kind, async () => {
      try {
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
          if (chainId !== shannonChain.id || !address) {
            setBanner({ kind: "err", text: "Wallet or network changed. Check Shannon and try again." });
            return;
          }
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
    });
  }

  async function mintCollateral() {
    setBanner(null);
    await run("faucet", async () => {
      await faucet.mutateAsync(undefined).catch(() => undefined);
    });
  }

  const faucet = useMutation({
    mutationFn: () => exchange.mintTestCollateral(),
    onSuccess: (txHash) => {
      setBanner({ kind: "ok", text: "Minted up to 10,000 tUSDC.", txHash });
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
    setBanner(null);
    await run(side, async () => {
      try {
        const txHash = await executeCall(exchange, win, intent);
        setBanner({
          kind: "ok",
          text: `Called ${side.toUpperCase()} · ${fmt(intent.plan.contracts, 3)} contracts`,
          txHash,
        });
        setReceipts((prev) => [
          {
            asset: win.asset,
            intervalSec: win.intervalSec,
            side,
            line: win.openingPrice,
            expiry: win.expiry,
            stake: Number(stake) || intent.plan.maxLoss,
            contracts: intent.plan.contracts,
            avgOdds: intent.plan.price,
            payoutIfWin: intent.plan.payoutIfWin,
            maxLoss: intent.plan.maxLoss,
            txHash: txHash ?? "",
            marketId: win.marketId,
            ts: Math.floor(now),
          },
          ...prev,
        ].slice(0, 8));
        void posQ.refetch().then(() => {
          void qc.invalidateQueries({ queryKey: ["fills"] });
          void qc.invalidateQueries({ queryKey: ["pnl"] });
        });
      } catch (e) {
        setBanner({ kind: "err", text: revertCopy(e) });
      }
    });
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
    setBanner(null);
    await run(side === "up" ? "exit-up" : "exit-down", async () => {
      try {
        const txHash = await executeExit(exchange, win, intent);
        setBanner({ kind: "ok", text: `Exited ${side.toUpperCase()}`, txHash });
        void posQ.refetch().then(() => {
          void qc.invalidateQueries({ queryKey: ["fills"] });
          void qc.invalidateQueries({ queryKey: ["pnl"] });
        });
      } catch (e) {
        setBanner({ kind: "err", text: revertCopy(e) });
      }
    });
  }

  async function claimAll() {
    if (!address) return;
    setBanner(null);
    await run("claim", async () => {
      try {
        const receipt = await exchange.claimFinalized(address);
        setBanner({
          kind: "ok",
          text: claimReceiptCopy(receipt, TUSDC.decimals),
          txHash: receipt.txHash,
        });
        void qc.invalidateQueries({ queryKey: ["fills"] });
        void qc.invalidateQueries({ queryKey: ["pnl"] });
        void qc.invalidateQueries({ queryKey: ["claims"] });
      } catch (e) {
        setBanner({ kind: "err", text: revertCopy(e) });
      }
    });
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
    setBanner(null);
    await run(side === "up" ? "rest-up" : "rest-down", async () => {
      try {
        const txHash = await executeRest(exchange, win, intent);
        setBanner({
          kind: "ok",
          text: `Resting ${side.toUpperCase()} · ${fmt(intent.plan.contracts, 3)} @ ${fmt(intent.plan.price * 100, 1)}%`,
          txHash,
        });
        void openQ.refetch();
      } catch (e) {
        setBanner({ kind: "err", text: revertCopy(e) });
      }
    });
  }

  async function cancelTicket(id: string, symbol: string) {
    setBanner(null);
    await run("cancel", async () => {
      try {
        const txHash = await exchange.cancelOpenTicket(id, symbol);
        setBanner({
          kind: "ok",
          text: "Cancelled resting order. Escrow returns to this wallet.",
          txHash,
        });
        void openQ.refetch();
      } catch (e) {
        setBanner({ kind: "err", text: revertCopy(e) });
      }
    });
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
        step={step}
        stepPending={totePrimaryCopy(
          primary,
          {
            connecting,
            switching,
            approving: writing || approveWait.isLoading || approveCooldown,
            claiming: busy === "claim",
          },
          board.phase,
          TUSDC.decimals,
        )}
        claimCopy={claimSessionCopy(claims, live?.decimals ?? TUSDC.decimals)}
        claimDue={primary.kind === "claim"}
        autoKey={autoTried.current || null}
        cadenceStates={cadenceStates}
        faucetEnabled={isConnected && chainId === shannonChain.id}
        onPrimary={() => void onPrimary()}
        onCall={(side) => void callSide(side)}
        onExit={(side) => void exitSide(side)}
        onClaim={() => void claimAll()}
        onFaucet={() => void mintCollateral()}
        onCancel={(id, symbol) => void cancelTicket(id, symbol)}
        onRest={(side) => void restSide(side)}
        depth={depth}
        feeBps={feeQ.data}
      />

      {address && <PnlStrip fills={fillsQ.data} positions={pnlQ.data} />}

      <ReceiptStrip receipts={receipts} history={historyQ.data} />

      <Pulse
        asset={asset}
        price={priceQ.data ?? undefined}
        priceSamples={priceSamples}
        impliedSamples={impliedSamples}
        history={historyQ.data}
        fills={marketFillsQ.data ?? []}
      />

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
            <button className="ghost" type="button" disabled={busy !== null} onClick={() => void mintCollateral()}>
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
