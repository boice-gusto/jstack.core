import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { RouteFilterProvider } from "@/components/route-filter-context";

import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "jstack dashboard",
  description: "Team operations dashboard",
  icons: {
    icon: "/logo-placeholder.png",
    apple: "/logo-placeholder.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={cn(
          inter.className,
          "min-h-screen bg-background font-sans text-foreground antialiased",
        )}
      >
        <RouteFilterProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-foreground focus:shadow focus:outline focus:outline-2 focus:outline-ring"
          >
            Skip to content
          </a>
          <AppShell>{children}</AppShell>
        </RouteFilterProvider>
      </body>
    </html>
  );
}
