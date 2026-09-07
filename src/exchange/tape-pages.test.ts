import { describe, expect, it } from "vitest";
import { readTapePages } from "./tape-pages";

describe("readTapePages", () => {
  it("stops after a short page — the tape is exhausted", async () => {
    let calls = 0;
    const rows = await readTapePages(
      async () => {
        calls++;
        return [1, 2];
      },
      3,
      9,
    );
    expect(rows).toEqual([1, 2]);
    expect(calls).toBe(1);
  });

  it("follows offset pages until the tape runs out", async () => {
    const rows = await readTapePages(
      async (offset) => (offset < 6 ? [offset + 1, offset + 2] : []),
      2,
      10,
    );
    expect(rows).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("never fetches past the hard cap — a hostile pool cannot loop the reader", async () => {
    let calls = 0;
    const rows = await readTapePages(
      async () => {
        calls++;
        return [calls * 2 - 1, calls * 2];
      },
      2,
      6,
    );
    expect(rows).toEqual([1, 2, 3, 4, 5, 6]);
    expect(calls).toBe(3);
  });

  it("flattens in order with no duplicates or reordering", async () => {
    const rows = await readTapePages(
      async (offset) => (offset === 0 ? ["a", "b"] : offset === 2 ? ["c"] : []),
      2,
      6,
    );
    expect(rows).toEqual(["a", "b", "c"]);
  });
});
