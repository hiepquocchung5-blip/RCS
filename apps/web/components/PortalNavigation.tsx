"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadSession, type Session } from "@/lib/session";

const PUBLIC_LINKS = [
  { href: "/showcase", label: "Our work" },
  { href: "/about", label: "About" },
  { href: "/request", label: "Start a project" },
] as const;

const PORTAL_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/board", label: "Delivery Board" },
] as const;

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

  const links = session === null
    ? PUBLIC_LINKS
    : session.user.role === "admin"
      ? [...PORTAL_LINKS, { href: "/logs", label: "Activity" }, { href: "/admin", label: "Admin" }]
      : session.user.role === "pm"
        ? [...PORTAL_LINKS, { href: "/logs", label: "Activity" }]
        : PORTAL_LINKS;

  return (
    <nav aria-label={session === null ? "Public navigation" : "Dev Hub navigation"} className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
            pathname === link.href
              ? "bg-rise-surface-2 text-rise-accent"
              : "text-rise-muted hover:text-rise-accent"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
