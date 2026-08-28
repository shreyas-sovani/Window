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

export function routeHref(r: Route): string {
  return r === "app" ? "#/app" : r === "docs" ? "#/docs" : "#/";
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
