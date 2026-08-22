"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const homeToc: { href: string; label: string }[] = [
  { href: "#overview", label: "Overview" },
  { href: "#start", label: "Start here" },
  { href: "#workspace", label: "Workspace" },
  { href: "#all-routes", label: "All routes" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-border bg-sidebar px-4 py-4 lg:sticky lg:top-14 lg:max-h-[calc(100vh-3.5rem)] lg:self-start lg:overflow-auto lg:border-b-0 lg:border-r">
      <h2 className="mb-2 mt-0 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Navigation
      </h2>
      <nav className="flex flex-col gap-0.5" aria-label="Primary">
        {ROUTES.map(({ href, label, status }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-[calc(var(--radius)-2px)] px-2 py-1.5 text-sm text-foreground no-underline transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                active && "bg-accent font-medium text-accent-foreground",
              )}
            >
              <span>{label}</span>
              {status === "stub" ? (
                <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-0 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                  stub
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {pathname === "/" ? (
        <>
          <h2 className="mb-2 mt-6 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </h2>
          <nav className="flex flex-col gap-0.5" aria-label="Table of contents">
            {homeToc.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-[calc(var(--radius)-2px)] px-2 py-1.5 text-sm text-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}
    </aside>
  );
}
