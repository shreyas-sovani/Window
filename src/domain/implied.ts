import type { BookTop } from "../exchange/port";

/** Live Up probability from the top of the book. Ask is what a Call Up pays. */
export function impliedUp(book: BookTop | undefined): number | undefined {
  if (!book) return undefined;
  return book.ask ?? book.bid;
}

/** Convert raw collateral-scaled book levels into an Up BookTop in (0, 1). */
export function bookTopFromRaw(input: {
  bidRaw?: bigint;
  askRaw?: bigint;
  decimals: number;
}): BookTop {
  const scale = 10 ** input.decimals;
  return {
    bid: input.bidRaw === undefined ? undefined : Number(input.bidRaw) / scale,
    ask: input.askRaw === undefined ? undefined : Number(input.askRaw) / scale,
  };
}
