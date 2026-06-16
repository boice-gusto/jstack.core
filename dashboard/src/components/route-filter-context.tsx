"use client";

import * as React from "react";

type RouteFilterContextValue = {
  query: string;
  setQuery: (q: string) => void;
};

const RouteFilterContext = React.createContext<RouteFilterContextValue | null>(null);

export function RouteFilterProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = React.useState("");
  const value = React.useMemo(() => ({ query, setQuery }), [query]);
  return <RouteFilterContext.Provider value={value}>{children}</RouteFilterContext.Provider>;
}

export function useRouteFilter(): RouteFilterContextValue {
  const ctx = React.useContext(RouteFilterContext);
  if (!ctx) {
    return { query: "", setQuery: () => {} };
  }
  return ctx;
}
