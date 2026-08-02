import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";
import { SessionBadge } from "@/components/SessionBadge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PortalNavigation } from "@/components/PortalNavigation";
import { getHomeUrl } from "@/lib/api";

export const metadata: Metadata = {
  title: "RCS — RiseCoreStudio",
  description: "Agency delivery, project planning and team operations.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0c1322",
};

const THEME_BOOT = `try{if(localStorage.getItem("rcs.theme")==="light")document.documentElement.classList.add("light")}catch(e){}`;
const SW_REGISTER = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}`;
const TMA_BOOT = `try{if(window.Telegram&&window.Telegram.WebApp){window.Telegram.WebApp.ready();window.Telegram.WebApp.expand();}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body
        className="flex h-screen flex-col overflow-hidden font-sans antialiased"
        suppressHydrationWarning
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
        <script dangerouslySetInnerHTML={{ __html: TMA_BOOT }} />
        <ToastProvider>
          <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-rise-border bg-rise-surface px-3 sm:gap-5 sm:px-5">
            <a href={getHomeUrl()} aria-label="RiseCoreStudio home" className="flex shrink-0 items-center gap-2.5">
              <img src="/rcs.svg" alt="RiseCoreStudio logo" className="h-7 w-7 rounded-lg object-contain" />
              <span className="font-bold tracking-tight text-rise-accent font-display text-base">
                RCS
              </span>
              <span className="hidden text-xs text-rise-muted sm:inline font-mono">
                RiseCoreStudio
              </span>
            </a>
            <div className="min-w-0 flex-1"><PortalNavigation /></div>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <SessionBadge />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
