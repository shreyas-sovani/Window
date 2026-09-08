import { useCallback, useEffect, useState } from "react";

export type Route = "landing" | "docs" | "app";

function hashPath(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return raw.split("?")[0] || "/";
}

export function parseRoute(hash: string): Route {
  const path = hashPath(hash);
  if (path === "/docs" || path.startsWith("/docs/")) return "docs";
  if (path === "/app" || path.startsWith("/app/")) return "app";
  return "landing";
}

/** Reads one query param from after the hash (`#/app?d=…`). Null when absent. */
export function hashParam(hash: string, key: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const q = raw.split("?")[1];
  if (!q) return null;
  for (const pair of q.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq) === key) {
      try {
        return decodeURIComponent(pair.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function routeHref(r: Route): string {
  return r === "app" ? "#/app" : r === "docs" ? "#/docs" : "#/";
}

/** Link params the terminal reads: a challenge, its accept, a demo marker, a fills blob. */
const LINK_KEYS = ["d", "a", "demo", "s"];

/**
 * Shared links lose their fragment in some clients (chat previews, QR
 * rewriters, mail scanners), which would land a challenge on the landing page
 * with the proof sitting unread in the query string. When that happens, lift
 * the query into the terminal hash the router understands. Returns null when
 * there is nothing to lift — no link params, or the hash already routes to the
 * app, in which case the hash wins.
 */
export function bootstrapSearchLink(search: string, hash: string): string | null {
  if (parseRoute(hash) === "app") return null;
  const query = (search.startsWith("?") ? search.slice(1) : search).replace(/^&+|&+$/g, "");
  if (!query) return null;
  const keys = query.split("&").map((pair) => pair.split("=")[0]);
  if (!keys.some((key) => LINK_KEYS.includes(key))) return null;
  return `#/app?${query}`;
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((r: Route) => {
    window.location.hash = routeHref(r);
  }, []);
  return [route, navigate];
}

/** One query param after the hash, live across hashchanges (`#/app?d=…` → `#/app`). */
export function useHashParam(key: string): string | null {
  const [value, setValue] = useState<string | null>(() => hashParam(window.location.hash, key));
  useEffect(() => {
    const onHash = () => setValue(hashParam(window.location.hash, key));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [key]);
  return value;
}
