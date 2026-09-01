import { describe, expect, it } from "vitest";
import { hashParam, parseRoute, routeHref } from "./router";

describe("parseRoute", () => {
  it("does not treat an app prefix as the terminal", () => {
    expect(parseRoute("#/apps")).toBe("landing");
  });

  it("maps the three pages and ignores a query string", () => {
    expect(parseRoute("")).toBe("landing");
    expect(parseRoute("#/")).toBe("landing");
    expect(parseRoute("#/docs")).toBe("docs");
    expect(parseRoute("#/docs/")).toBe("docs");
    expect(parseRoute("#/app")).toBe("app");
    expect(parseRoute("#/app?from=landing")).toBe("app");
  });
});

describe("hashParam", () => {
  it("reads a query param that lives after the hash", () => {
    expect(hashParam("#/app?d=1.abc_def", "d")).toBe("1.abc_def");
    expect(hashParam("#/app?d=1.abc&x=2", "d")).toBe("1.abc");
    expect(hashParam("#/app?x=2", "d")).toBeNull();
    expect(hashParam("#/app", "d")).toBeNull();
    expect(hashParam("", "d")).toBeNull();
  });

  it("treats malformed percent encoding as an invalid param instead of throwing", () => {
    expect(hashParam("#/app?d=%E0%A4%A", "d")).toBeNull();
  });
});

describe("routeHref", () => {
  it("prints the three hash paths", () => {
    expect(routeHref("landing")).toBe("#/");
    expect(routeHref("docs")).toBe("#/docs");
    expect(routeHref("app")).toBe("#/app");
  });
});
