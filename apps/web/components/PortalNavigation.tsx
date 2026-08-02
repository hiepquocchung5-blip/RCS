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
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("rcs:session", sync);
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
    <nav aria-label={session === null ? "Public navigation" : "Dev Hub navigation"} className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
      {links.map((link) => (
        <a
          key={link.href}
          href={resolveHref(link)}
          aria-current={pathname === link.href ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
            pathname === link.href
              ? "bg-rise-surface-2 text-rise-accent"
              : "text-rise-muted hover:text-rise-accent"
          }`}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

