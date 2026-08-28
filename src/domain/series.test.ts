import { describe, expect, it } from "vitest";
import { cadenceLabel, canonicalInterval } from "./series";

describe("canonicalInterval", () => {
  it("snaps a 3598s indexer window onto the 1h series", () => {
    expect(canonicalInterval(3598)).toBe(3600);
  });

  it("leaves a true 15m window alone", () => {
    expect(canonicalInterval(900)).toBe(900);
  });
});

describe("cadenceLabel", () => {
  it("names minutes, hours, and the 24h series without 1440m", () => {
    expect(cadenceLabel(60)).toBe("1m");
    expect(cadenceLabel(300)).toBe("5m");
    expect(cadenceLabel(900)).toBe("15m");
    expect(cadenceLabel(3600)).toBe("1h");
    expect(cadenceLabel(14400)).toBe("4h");
    expect(cadenceLabel(86400)).toBe("24h");
  });

  it("snaps indexer noise before labeling", () => {
    expect(cadenceLabel(3598)).toBe("1h");
  });
});
