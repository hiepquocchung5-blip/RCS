"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadSession, type Session } from "@/lib/session";

import { isStockFounder } from "@rcs/shared";
import { getAuthUrl, getStockUrl } from "@/lib/api";

const PUBLIC_LINKS = [
  { href: "/showcase", label: "Our work", resolver: null },
  { href: "/about", label: "About", resolver: null },
  { href: "/request", label: "Start a project", resolver: "auth" as const },
] as const;

const PORTAL_LINKS = [
  { href: "/projects", label: "Projects", resolver: "auth" as const },
  { href: "/board", label: "Delivery Board", resolver: "auth" as const },
  { href: "/proposals", label: "Proposals", resolver: "auth" as const },
] as const;

type NavLink = { href: string; label: string; resolver: "auth" | "stock" | null };

export function PortalNavigation() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setSession(loadSession());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("rcs:session", sync);

    // Global Keybinding Shortcuts (G B, G P, G S, G L)
    let lastKey = "";
    let timer: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (lastKey === "g") {
        if (key === "b") window.location.href = getAuthUrl("/board");
        if (key === "p") window.location.href = getAuthUrl("/projects");
        if (key === "s") window.location.href = "/showcase";
        if (key === "l") window.location.href = getAuthUrl("/logs");
        lastKey = "";
        if (timer) clearTimeout(timer);
      } else if (key === "g") {
        lastKey = "g";
        timer = setTimeout(() => {
          lastKey = "";
        }, 1200);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rcs:session", sync);
      window.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (session === undefined) {
    return <div aria-hidden="true" className="h-4 w-40 animate-pulse rounded bg-rise-surface-2" />;
  }

  let links: NavLink[] = session === null
    ? [...PUBLIC_LINKS]
    : session.user.role === "admin"
      ? [...PORTAL_LINKS, { href: "/logs", label: "Activity", resolver: "auth" as const }, { href: "/admin", label: "Admin", resolver: "auth" as const }]
      : session.user.role === "pm"
        ? [...PORTAL_LINKS, { href: "/logs", label: "Activity", resolver: "auth" as const }]
        : [...PORTAL_LINKS];

  if (session !== null && isStockFounder(session.user.email)) {
    links = [...links, { href: "/stock", label: "Stocks", resolver: "stock" as const }];
  }

  function resolveHref(link: NavLink): string {
    if (link.resolver === "auth") return getAuthUrl(link.href);
    if (link.resolver === "stock") return getStockUrl();
    return link.href;
  }

  return (
    <>
      {/* Desktop Top Inline Navigation (sm and up) */}
      <nav aria-label={session === null ? "Public navigation" : "Dev Hub navigation"} className="hidden sm:flex min-w-0 items-center gap-1.5 overflow-x-auto text-sm">
        {links.map((link) => (
          <a
            key={link.href}
            href={resolveHref(link)}
            aria-current={pathname === link.href ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-all ${
              pathname === link.href
                ? "bg-rise-accent/15 text-rise-accent border border-rise-accent/30 shadow-sm"
                : "text-rise-muted hover:text-rise-text hover:bg-rise-surface-2/60"
            }`}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Floating Mobile Bottom Glass Dock (under sm screen width) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 sm:hidden w-[92%] max-w-md">
        <nav
          aria-label="Mobile Bottom Navigation"
          className="flex items-center justify-around gap-1 rounded-full border border-rise-border/80 bg-rise-surface/85 p-1.5 backdrop-blur-xl shadow-2xl ring-1 ring-white/10"
        >
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <a
                key={link.href}
                href={resolveHref(link)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight transition-all active:scale-95 ${
                  active
                    ? "bg-rise-accent text-rise-bg shadow-md font-bold"
                    : "text-rise-muted hover:text-rise-text"
                }`}
              >
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
}

