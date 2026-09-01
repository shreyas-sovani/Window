import { useLiveBinaryOrderBookByMarket, useWatchMarket } from "@somnia-chain/markets-sdk/react";
import type { BookDepth } from "../domain/book-depth";
import { bookDepthFromBinary, bookHasTop, bookTopFromBinary } from "../exchange/live-book";
import type { BookTop } from "../exchange/port";

/** Prefer the SDK live book (keyed by marketId so recycled pools cannot leak). */
export function useLiveOdds(input: {
  pool?: string;
  marketId?: string;
  decimals: number;
  polled?: BookTop;
  enabled?: boolean;
}): { book: BookTop | undefined; depth: BookDepth } {
  const enabled = input.enabled ?? true;
  useWatchMarket(enabled ? input.pool : undefined);
  const live = useLiveBinaryOrderBookByMarket(enabled ? input.marketId : undefined);
  const watched = bookTopFromBinary(live, input.decimals);
  const book = bookHasTop(watched) ? watched : input.polled;
  return { book, depth: bookDepthFromBinary(live, input.decimals) };
}
