import type { BinaryOrderBook } from "@somnia-chain/markets-sdk";
import { readBookDepth, type BookDepth } from "../domain/book-depth";
import { bookTopFromRaw } from "../domain/implied";
import type { BookTop } from "./port";

export function bookTopFromBinary(book: BinaryOrderBook | undefined, decimals: number): BookTop {
  if (!book) return {};
  return bookTopFromRaw({
    bidRaw: book.yesBids[0]?.price,
    askRaw: book.yesAsks[0]?.price,
    decimals,
  });
}

export function bookDepthFromBinary(book: BinaryOrderBook | undefined, decimals: number): BookDepth {
  return readBookDepth({
    bids: book?.yesBids ?? [],
    asks: book?.yesAsks ?? [],
    decimals,
  });
}

export function bookHasTop(book: BookTop | undefined): boolean {
  return book?.ask !== undefined || book?.bid !== undefined;
}
