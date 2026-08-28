import { describe, expect, it } from "vitest";
import { parseRoute, routeHref } from "./router";

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

describe("routeHref", () => {
  it("prints the three hash paths", () => {
    expect(routeHref("landing")).toBe("#/");
    expect(routeHref("docs")).toBe("#/docs");
    expect(routeHref("app")).toBe("#/app");
  });
});
