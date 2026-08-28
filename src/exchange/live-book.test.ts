import { describe, expect, it } from "vitest";
import { bookDepthFromBinary } from "./live-book";

describe("bookDepthFromBinary", () => {
  it("reads the Up book and ignores inverted NO sides", () => {
    const depth = bookDepthFromBinary(
      {
        yesBids: [{ price: 400_000n, quantity: 2_000_000n }],
        yesAsks: [{ price: 500_000n, quantity: 3_000_000n }],
        noBids: [{ price: 500_000n, quantity: 99_000_000n }],
        noAsks: [{ price: 600_000n, quantity: 99_000_000n }],
      },
      6,
    );
    expect(depth.bids[0]?.contracts).toBe(2);
    expect(depth.asks[0]?.contracts).toBe(3);
    expect(depth.bids).toHaveLength(1);
    expect(depth.asks).toHaveLength(1);
  });

  it("is empty when the live store has not hydrated", () => {
    expect(bookDepthFromBinary(undefined, 6).empty).toBe(true);
  });
});
