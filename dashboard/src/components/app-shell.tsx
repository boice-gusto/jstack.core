"use client";

import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <>
      <DashboardHeader />
      <div className="grid min-h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <AppSidebar />
        <main id="main-content" className="min-w-0 px-5 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </>
  );
}
