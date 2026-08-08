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
const TMA_BOOT = `try{if(window.Telegram&&window.Telegram.WebApp){var app=window.Telegram.WebApp;app.ready();app.expand();app.setHeaderColor('#0c1322');app.setBackgroundColor('#0c1322');}}catch(e){}`;

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
          <header className="sticky top-0 z-40 flex min-h-16 shrink-0 items-center gap-2 border-b border-rise-border/80 bg-rise-surface/85 px-4 backdrop-blur-xl shadow-lg sm:gap-5 sm:px-6">
            <a href={getHomeUrl()} aria-label="RiseCoreStudio home" className="group flex shrink-0 items-center gap-3 transition-transform hover:scale-105">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-rise-bg/60 border border-rise-accent/30 p-1 shadow-md group-hover:border-rise-accent group-hover:shadow-[0_0_14px_rgba(0,240,255,0.3)] transition-all">
                <img src="/rcs.svg" alt="RiseCoreStudio logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-rise-text group-hover:text-rise-accent font-display text-base transition-colors leading-none">
                  RCS
                </span>
                <span className="hidden text-[10px] text-rise-muted/80 sm:inline font-mono tracking-widest uppercase">
                  RiseCoreStudio
                </span>
              </div>
            </a>
            <div className="min-w-0 flex-1"><PortalNavigation /></div>
            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-rise-border/60 bg-rise-bg/40 px-2.5 py-1 text-[10px] font-mono text-rise-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-rise-accent animate-pulse" />
                Hotkeys: <kbd className="text-rise-accent font-bold">G</kbd> + <kbd className="text-rise-accent font-bold">B/P/S/L</kbd>
              </div>
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
