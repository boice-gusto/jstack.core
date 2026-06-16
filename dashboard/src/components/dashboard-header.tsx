"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { useRouteFilter } from "@/components/route-filter-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { query, setQuery } = useRouteFilter();
  const showFilter = pathname === "/";
  const showLogout = pathname !== "/login";

  async function handleLogout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // still navigate away; cookie clear is best-effort from client
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 flex items-center gap-4 border-b border-border bg-background/90 px-5 py-3 backdrop-blur-md">
      <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3 no-underline hover:opacity-90">
        <Image
          src="/logo-placeholder.png"
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-[calc(var(--radius)-2px)] object-contain"
        />
        <div className="min-w-0">
          <h1 className="m-0 text-[1.05rem] font-semibold tracking-tight text-foreground">jstack</h1>
          <p className="m-0 hidden text-xs text-muted-foreground sm:block">Team operations dashboard</p>
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {showFilter ? (
          <div className="relative flex min-w-0 max-w-md flex-1 flex-col gap-1">
            <label htmlFor="route-filter" className="sr-only">
              Filter routes
            </label>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 opacity-45" aria-hidden />
              <Input
                id="route-filter"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter routes…"
                className="h-9 pl-9 text-sm"
                autoComplete="off"
              />
            </div>
            <p className="m-0 hidden pl-0.5 text-[0.7rem] text-muted-foreground md:block">
              Narrow the list below by name or path
            </p>
          </div>
        ) : null}

        {showLogout ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void handleLogout()}>
            Log out
          </Button>
        ) : null}
      </div>
    </header>
  );
}
