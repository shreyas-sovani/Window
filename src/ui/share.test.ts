// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareLink, shareText } from "./share";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shareLink", () => {
  it("prefers the native share sheet and reports shared", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const got = await shareLink("https://x.test/#/app?d=1.abc", "Window Duel challenge");
    expect(got).toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({
      title: "Window Duel challenge",
      url: "https://x.test/#/app?d=1.abc",
    });
  });

  it("falls back to the clipboard with the exact URL and reports copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const got = await shareLink("https://x.test/#/app?d=1.abc", "Window Duel challenge");
    expect(got).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("https://x.test/#/app?d=1.abc");
  });

  it("reports failed when a user dismisses the share sheet", async () => {
    const share = vi.fn().mockRejectedValue(new Error("abort"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    expect(await shareLink("https://x.test/#/app?d=1.abc", "t")).toBe("failed");
  });
});

describe("shareText", () => {
  it("shares composed text through the sheet, then the clipboard", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    expect(await shareText("a receipt", "R")).toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({ title: "R", text: "a receipt" });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    expect(await shareText("a receipt", "R")).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("a receipt");
  });
});
