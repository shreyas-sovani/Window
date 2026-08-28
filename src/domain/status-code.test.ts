import { describe, expect, it } from "vitest";
import { statusCode } from "./lifecycle";

describe("statusCode", () => {
  it("maps indexer labels to on-chain enums", () => {
    expect(statusCode("Trading")).toBe(1);
    expect(statusCode("Locked")).toBe(2);
    expect(statusCode("Finalized")).toBe(4);
    expect(statusCode(1)).toBe(1);
  });
});
