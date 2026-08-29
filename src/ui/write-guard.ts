import { useRef, useState } from "react";
import type { Busy } from "./CallBoard";

export type GuardedAction = Exclude<Busy, null>;

/**
 * Wallet-write mutex. The ref is the lock: it flips synchronously on entry, so a
 * second activation in the same tick — double-click, click + Enter, a rerendered
 * control — sees the lock and is ignored before any async work starts. State
 * mirrors the ref for rendering. Release happens only in finally (receipt,
 * rejection, replacement, or revert all land there); nothing retries on its own.
 */
export function useWriteGuard(onBlocked?: (action: GuardedAction) => void): {
  busy: Busy;
  run: (action: GuardedAction, fn: () => Promise<void>) => Promise<void>;
} {
  const held = useRef<GuardedAction | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;

  async function run(action: GuardedAction, fn: () => Promise<void>): Promise<void> {
    if (held.current !== null) {
      blocked.current?.(held.current);
      return;
    }
    held.current = action;
    setBusy(action);
    try {
      await fn();
    } finally {
      held.current = null;
      setBusy(null);
    }
  }

  return { busy, run };
}
