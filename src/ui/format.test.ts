import { describe, expect, it } from "vitest";
import { countdown, fmt, historyLabel, shorten } from "./format";

describe("countdown", () => {
  it("renders remaining minutes and seconds", () => {
    expect(countdown(1_090, 1_000)).toBe("01:30");
  });

  it("floors at zero after expiry", () => {
    expect(countdown(900, 1_000)).toBe("00:00");
  });

  it("names hours when more than an hour remains", () => {
    expect(countdown(1_000 + 86_400, 1_000)).toBe("24h 00:00");
    expect(countdown(1_000 + 4 * 3_600 + 90, 1_000)).toBe("4h 01:30");
  });
});

describe("historyLabel", () => {
  it("names Up Down and Void", () => {
    expect(historyLabel("up")).toBe("Up");
    expect(historyLabel("down")).toBe("Down");
    expect(historyLabel("void")).toBe("Void");
    expect(historyLabel("unknown")).toBe("?");
  });
});

describe("shorten", () => {
  it("keeps the first six and last four of an address", () => {
    expect(shorten("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });

  it("leaves a short hash alone instead of doubling it", () => {
    expect(shorten("0xabc")).toBe("0xabc");
    expect(shorten("")).toBe("—");
  });
});

describe("fmt", () => {
  it("renders an em dash for missing numbers", () => {
    expect(fmt(undefined)).toBe("—");
  });
});
