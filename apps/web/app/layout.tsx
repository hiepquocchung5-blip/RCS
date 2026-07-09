import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { SessionBadge } from "@/components/SessionBadge";

export const metadata: Metadata = {
  title: "RCS — RiseCoreStudio",
  description: "The Ultimate Developer Hub & Agency CMS",
};

const NAV_LINKS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/board", label: "Board" },
  { href: "/admin", label: "Admin" },
  { href: "/logs", label: "SystemLogs" },
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen flex-col overflow-hidden font-sans antialiased">
        <ToastProvider>
          <header className="flex h-12 shrink-0 items-center gap-6 border-b border-rise-border bg-rise-surface px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-rise-accent">
                ▲ RCS
              </span>
              <span className="hidden text-xs text-rise-muted sm:inline">
                RiseCoreStudio
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-rise-muted transition-colors hover:text-rise-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <SessionBadge />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
