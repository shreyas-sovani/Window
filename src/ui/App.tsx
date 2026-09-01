import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Hex } from "viem";
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
import { explorerTx, oracleReceipt, STT_FAUCET, TUSDC } from "../chain/shannon";
import { autoSeries, hottestCadence } from "../domain/auto-series";
import { decodeChallengeLink } from "../domain/challenge-link";
import { readDuel, tapeDuelFill, type Duel as DuelState } from "../domain/duel";
import { healthDetail, marketHealth } from "../domain/market-health";
import { chipStatus, nextStep } from "../domain/onboarding";
import { callSkipCopy, executeCall, executeExit, executeRest, prepareExit, prepareRest, restSkipCopy } from "../domain/call-session";
import { callReceiptFromFill, filledCall } from "../domain/filled-call";
import { pickWindow } from "../domain/pick-window";
import { pnlCopy, pnlTotals, seriesPnl, seriesPnlCopy } from "../domain/pnl";
import { settlePreview, settlePreviewCopy } from "../domain/settle-preview";
import { historyLine, readSeriesRecord, seriesRecordCopy } from "../domain/series-record";
import { revertCopy } from "../domain/revert-copy";
import { approveAmount } from "../domain/wallet-gate";
import { totePrimary, totePrimaryCopy } from "../domain/tote-primary";
import { boardNotice } from "../domain/board-notice";
import { claimReceiptCopy, claimSessionCopy } from "../domain/claim-session";
import type { CallReceipt } from "../domain/proof-card";
import { readBoard, windowTickets } from "../domain/window-board";
import { rollPrompt, type LastCall } from "../domain/roll";
import { bindWallet, somniaExchange } from "../exchange/somnia";
import type { ExchangePort } from "../exchange/port";
import { CallBoard } from "./CallBoard";
import { ChallengeGate } from "./ChallengeStrip";
import { Duel } from "./Duel";
import { BookDrawer } from "./BookDrawer";
import { fmt, shorten } from "./format";
import { historyLabel } from "./format";
import { useBanner, useNow, usePulseSamples } from "./hooks";
import { PnlStrip } from "./PnlStrip";
import { Pulse } from "./Pulse";
import { ReceiptStrip } from "./ReceiptStrip";
import { useHashParam } from "./router";
import { useLiveOdds } from "./useLiveOdds";
import { Button } from "./kit";
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
  const [lastCall, setLastCall] = useState<LastCall | null>(null);
  const [dismissedRoll, setDismissedRoll] = useState<string>();

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

  // A challenge link pins its Window: select that series once so the board, book,
  // and history all face the market the duel is judged on.
  const duelRaw = useHashParam("d");
  const duelHint = duelRaw ? decodeChallengeLink(duelRaw) : null;
  const duelLiveWindow = useMemo(
    () => (duelHint ? (windowsQ.data ?? []).find((w) => w.marketId === duelHint.marketId) ?? null : null),
    [duelHint?.marketId, windowsQ.data],
  );
  // Finalized Windows leave listLiveWindows — a challenge link on a settled or
  // expired market still resolves through the by-id read.
  const duelMarketQ = useQuery({
    queryKey: ["duelmarket", duelHint?.marketId],
    queryFn: () => exchange.marketById(duelHint!.marketId as `0x${string}`),
    enabled: Boolean(duelHint?.marketId) && !duelLiveWindow,
    retry: 1,
  });
  const duelWindow = duelLiveWindow ?? (duelMarketQ.data ?? null);
  const duelPinned = useRef("");
  useEffect(() => {
    if (!duelHint || !duelWindow) return;
    if (duelPinned.current === duelWindow.marketId) return;
    if (liveHint?.marketId === duelWindow.marketId) return;
    duelPinned.current = duelWindow.marketId;
    setAsset(duelWindow.asset);
    setIntervalSec(duelWindow.intervalSec);
  }, [duelHint, duelWindow, liveHint?.marketId]);

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
    queryKey: ["open", address, liveHint?.marketId],
    queryFn: () => exchange.listOpenTickets(),
    enabled: Boolean(address),
    refetchInterval: 8_000,
  });
  const openTickets = useMemo(
    () => windowTickets(openQ.data ?? [], liveHint?.upSymbol, liveHint?.downSymbol),
    [openQ.data, liveHint?.upSymbol, liveHint?.downSymbol],
  );

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

  const health = useMemo(
    () =>
      marketHealth({
        book,
        depth,
        expirySec: liveHint?.expiry,
        intervalSec: liveHint?.intervalSec,
        nowSec: now,
      }),
    [book, depth, liveHint?.expiry, liveHint?.intervalSec, now],
  );

  const hotCadence = useMemo(
    () => hottestCadence(windowsQ.data ?? [], asset, now),
    [windowsQ.data, asset, now],
  );

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
  const duelStatusQ = useQuery({
    queryKey: ["duelstatus", duelHint?.marketId],
    queryFn: () => exchange.onchainStatus(duelHint!.marketId as `0x${string}`),
    enabled: Boolean(duelHint?.marketId),
    refetchInterval: 8_000,
    retry: 1,
  });
  const duelHistoryQ = useQuery({
    queryKey: ["duelhistory", duelWindow?.asset, duelWindow?.intervalSec, duelWindow?.venueId],
    queryFn: () => exchange.listSeriesHistory(duelWindow!.asset, duelWindow!.intervalSec, duelWindow!.venueId),
    enabled: Boolean(duelWindow),
    refetchInterval: 30_000,
    retry: 1,
  });
  const duelTapeQ = useQuery({
    queryKey: ["dueltape", duelWindow?.marketId],
    queryFn: () => exchange.fillsByPool(duelWindow!.pool, duelWindow!.decimals),
    enabled: Boolean(duelWindow),
    refetchInterval: 8_000,
    retry: 1,
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

  const duel: DuelState | null = useMemo(() => {
    if (duelRaw === null) return null;
    if (!duelHint) return { kind: "invalid", reason: "no-challenge" };
    if (!duelWindow) {
      return readDuel({
        hint: duelHint,
        window: null,
        windowStatus: 0,
        challengerFill: null,
        acceptor: address,
        acceptorFill: null,
        settlement: null,
        nowSec: now,
      });
    }
    // The chain decides: the pool's public tape must show the challenger's named
    // tx as a fill on this market, and this wallet's own take on the same market.
    const tape = duelTapeQ.data ?? [];
    const challengerProof = tapeDuelFill(tape, {
      marketId: duelWindow.marketId,
      txHash: duelHint.txHash,
      taker: duelHint.challenger,
      side: duelHint.side,
    });
    // Opposite side accepts; a same-side fill still refuses honestly. This
    // wallet's own take comes first; otherwise the acceptor is whoever else
    // filled the opposite side — the result view must render for any viewer.
    const opposite = (challengerProof?.side ?? duelHint.side) === "up" ? ("down" as const) : ("up" as const);
    const acceptorProof =
      (address
        ? (tapeDuelFill(tape, { marketId: duelWindow.marketId, taker: address, side: opposite }) ??
          tapeDuelFill(tape, { marketId: duelWindow.marketId, taker: address, side: duelHint.side }))
        : null) ??
      (challengerProof
        ? tapeDuelFill(tape, { marketId: duelWindow.marketId, side: opposite, notTaker: challengerProof.account })
        : null);
    const settledRow = (duelHistoryQ.data ?? []).find((h) => h.marketId === duelWindow.marketId && h.result !== "unknown");
    return readDuel({
      hint: duelHint,
      // DuelWindow reads the Line from `line`; LiveWindow carries it as openingPrice.
      window: { ...duelWindow, line: duelWindow.openingPrice },
      windowStatus: duelStatusQ.data ?? duelWindow.status,
      challengerFill: challengerProof,
      acceptor: address,
      acceptorFill: acceptorProof,
      settlement: settledRow ?? null,
      nowSec: now,
    });
  }, [duelRaw, duelHint, duelWindow, duelTapeQ.data, duelHistoryQ.data, duelStatusQ.data, address, now]);

  const duelAcceptSide = duel?.kind === "challenge" ? (duel.challenge.side === "up" ? ("down" as const) : ("up" as const)) : null;

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
          callable: Boolean(live) && (board.upPlan.ok || board.downPlan.ok),
          claimable: claims.windows,
        },
        live?.decimals ?? TUSDC.decimals,
      ),
    [isConnected, chainId, hasGas, bal, board.stakeRaw, board.upPlan.ok, board.downPlan.ok, allowance, live, claims.windows],
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
    const writeStartSec = Math.floor(Date.now() / 1000);
    await run(side, async () => {
      try {
        const txHash = await executeCall(exchange, win, intent);
        // The write result alone is not a fill. Read the wallet's tape back and
        // size the receipt, the roll, and any challenge from what actually filled.
        const tape = address ? await exchange.listFills(address) : [];
        const filled = filledCall(tape, {
          side,
          asset: win.asset,
          intervalSec: win.intervalSec,
          txHash,
          sinceSec: writeStartSec,
        });
        if (!filled) {
          setBanner({
            kind: "err",
            text: txHash
              ? "Sent, but nothing filled — leftovers cancelled, nothing resting, nothing at risk. No receipt, no challenge."
              : "Call was sent but the fill could not be verified. No receipt, no challenge.",
            txHash,
          });
          return;
        }
        const receipt = callReceiptFromFill(win, filled, Math.floor(now));
        setBanner({
          kind: "ok",
          text: `Called ${side.toUpperCase()} · filled ${fmt(filled.contracts, 3)} contracts @ ${fmt(filled.avgOdds * 100, 1)}%`,
          txHash: filled.txHash,
        });
        setReceipts((prev) => [receipt, ...prev].slice(0, 8));
        setLastCall({
          asset: win.asset,
          intervalSec: win.intervalSec,
          side,
          stake: filled.escrow,
          marketId: win.marketId,
        });
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

  const roll = useMemo(
    () => {
      const callableSide = lastCall
        ? lastCall.side === "up"
          ? board.upPlan.ok
          : board.downPlan.ok
        : false;
      return rollPrompt({
        last: lastCall,
        live,
        callable: Boolean(live) && board.gate.canCall && callableSide,
        dismissedMarketId: dismissedRoll,
      });
    },
    [lastCall, live, board.gate.canCall, board.upPlan.ok, board.downPlan.ok, dismissedRoll],
  );

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
          <div className="wordmark">Window Duel</div>
          <p className="usp">
            Challenge another wallet on the same Window. Two opposite Calls, two verified fills, one Line,
            one on-chain winner.
          </p>
          <p className="usp-note">Opponents are not counterparties — each Call is its own take.</p>
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

      {duel && (
        <Duel
          duel={duel}
          acceptBusy={primaryBusy || (duelAcceptSide !== null && busy === duelAcceptSide)}
          onAccept={() => {
            if (duelAcceptSide) void callSide(duelAcceptSide);
          }}
        />
      )}

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
        subordinate={Boolean(duel)}
        onlySide={duelAcceptSide ?? undefined}
        loading={windowsQ.isLoading}
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
        autoKey={autoTried.current || null}
        cadenceStates={cadenceStates}
        hotCadence={hotCadence}
        roll={roll}
        onRoll={(side) => void callSide(side)}
        onDismissRoll={() => live && setDismissedRoll(live.marketId)}
        faucetEnabled={isConnected && chainId === shannonChain.id}
        onPrimary={() => void onPrimary()}
        onCall={(side) => void callSide(side)}
        onFaucet={() => void mintCollateral()}
      />

      <ChallengeGate receipts={receipts} address={address} now={now} />

      {primary.kind === "claim" && (
        <section className="rewards" aria-label="Claim rewards">
          <div>
            <h3 className="rewards-title">Winnings ready</h3>
            <p className="rewards-sub">{claimSessionCopy(claims, live?.decimals ?? TUSDC.decimals)}</p>
          </div>
          <Button variant="primary" disabled={primaryBusy} onClick={() => void claimAll()}>
            {busy === "claim" ? "Claiming…" : "Claim"}
          </Button>
        </section>
      )}

      <details className="drawer more">
        <summary>More</summary>

        <section className="more-section" aria-label="Market">
          <div className="kicker">Market</div>
          <div className="meta">
            <div>
              Volume
              <strong className="mono">
                {live?.volumeQuote !== undefined ? `${fmt(live.volumeQuote, 2)} tUSDC` : "—"}
              </strong>
            </div>
            <div>
              Trades
              <strong className="mono">{live?.tradeCount ?? "—"}</strong>
            </div>
            <div>
              Book
              <strong className={`mono health ${health.grade}`} title={health.copy}>
                {health.grade === "none"
                  ? "No odds"
                  : health.grade === "strong"
                    ? "Strong"
                    : health.grade === "fair"
                      ? "Fair"
                      : "Thin"}
              </strong>
              <small className="mono health-detail">{healthDetail(health)}</small>
            </div>
          </div>
          <BookDrawer depth={depth} canRest={board.gate.canCall} busy={busy} onRest={(side) => void restSide(side)} />
        </section>

        {address && live && (
          <section className="more-section" aria-label="Position">
            <div className="kicker">Position</div>
            <div className="banner">
              Your call this Window:{" "}
              {posQ.data
                ? `${formatUnits(posQ.data.up, posQ.data.decimals)} Up · ${formatUnits(posQ.data.down, posQ.data.decimals)} Down`
                : "…"}
              {(() => {
                const preview = posQ.data
                  ? settlePreview({ up: posQ.data.up, down: posQ.data.down, feeBps: feeQ.data })
                  : null;
                return preview && !preview.empty && posQ.data ? (
                  <div className="settle">{settlePreviewCopy(preview, posQ.data.decimals, feeQ.data)}</div>
                ) : null;
              })()}
              <div className="actions" style={{ marginTop: 8 }}>
                <button
                  className="ghost"
                  type="button"
                  disabled={!posQ.data || posQ.data.up === 0n || busy !== null}
                  onClick={() => void exitSide("up")}
                >
                  {busy === "exit-up" ? "Exiting…" : "Exit Up"}
                </button>
                <button
                  className="ghost"
                  type="button"
                  disabled={!posQ.data || posQ.data.down === 0n || busy !== null}
                  onClick={() => void exitSide("down")}
                >
                  {busy === "exit-down" ? "Exiting…" : "Exit Down"}
                </button>
              </div>
            </div>
          </section>
        )}

        {openTickets.length > 0 && (
          <section className="more-section" aria-label="Resting orders">
            <div className="kicker">Resting orders</div>
            <div className="banner">
              Cancel to free escrow
              <ul className="tickets">
                {openTickets.map((t) => (
                  <li key={t.id}>
                    <span className="mono">
                      {t.side} {fmt(t.remaining, 3)} @ {fmt(t.price, 3)} · {t.symbol}
                    </span>
                    <button
                      className="ghost"
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void cancelTicket(t.id, t.symbol)}
                    >
                      {busy === "cancel" ? "Cancelling…" : "Cancel"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {((historyQ.data && historyQ.data.length > 0) || (address && seriesPnlCopy(seriesTotals, asset, intervalSec))) && (
          <section className="more-section" aria-label="Series history">
            <div className="kicker">Series history</div>
            <div className="history">
              {address && <div className="record pnl">{seriesPnlCopy(seriesTotals, asset, intervalSec)}</div>}
              {historyQ.data && historyQ.data.length > 0 && (
                <>
                  <div className="record">{seriesRecordCopy(readSeriesRecord(historyQ.data))}</div>
                  {historyQ.data.map((row) => {
                    const line = historyLine(row.openingPrice);
                    const body = (
                      <>
                        {historyLabel(row.result)}
                        <small>
                          {new Date(row.expiry * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {line !== undefined ? ` · ${fmt(line, 2)}` : ""}
                        </small>
                      </>
                    );
                    return row.oracleQuestionId ? (
                      <a
                        key={row.marketId}
                        className={`chip ${row.result}`}
                        href={oracleReceipt(row.oracleQuestionId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {body}
                      </a>
                    ) : (
                      <span key={row.marketId} className={`chip ${row.result}`}>
                        {body}
                      </span>
                    );
                  })}
                </>
              )}
            </div>
          </section>
        )}

        <section className="more-section" aria-label="Receipts">
          <ReceiptStrip receipts={receipts} history={historyQ.data} />
        </section>

        <Pulse
          asset={asset}
          price={priceQ.data ?? undefined}
          priceSamples={priceSamples}
          impliedSamples={impliedSamples}
          history={historyQ.data}
          fills={marketFillsQ.data ?? []}
        />

        {address && <PnlStrip fills={fillsQ.data} positions={pnlQ.data} />}

        <div className="utilities">
          {primary.kind !== "claim" && address && (
            <button className="linklike" type="button" disabled={busy !== null} onClick={() => void claimAll()}>
              {busy === "claim" ? "Claiming…" : "Claim finalized"}
            </button>
          )}
          {isConnected && chainId === shannonChain.id && step.kind !== "mint" && (
            <button className="linklike" type="button" disabled={busy !== null} onClick={() => void mintCollateral()}>
              {busy === "faucet" ? "Minting…" : "Mint tUSDC"}
            </button>
          )}
          <a className="linklike" href={STT_FAUCET} target="_blank" rel="noreferrer">
            Get STT gas
          </a>
          {live?.oracleQuestionId && (
            <a className="linklike" href={oracleReceipt(live.oracleQuestionId)} target="_blank" rel="noreferrer">
              Oracle receipt
            </a>
          )}
        </div>
      </details>

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
        Window Duel · dreamDEX Event Contracts on Somnia Shannon testnet · zero custom contracts ·{" "}
        <a href="https://docs.dreamdex.io/developers/event-contracts" target="_blank" rel="noreferrer">
          Developer docs
        </a>
      </footer>
    </div>
  );
}
