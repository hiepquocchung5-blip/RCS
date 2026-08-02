import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";

  const mainDomain = "risecorestudio.com";
  const authDomain = "auth.risecorestudio.com";

  // In development, ignore subdomain routing on localhost
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  if (isLocalhost) {
    return NextResponse.next();
  }

  const isAuthSubdomain = host.toLowerCase().startsWith("auth.");
  const isStockSubdomain = host.toLowerCase().startsWith("stock.");

  if (isStockSubdomain) {
    // Transparently rewrite to /stock
    if (!url.pathname.startsWith("/stock")) {
      url.pathname = `/stock${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }

  if (isAuthSubdomain) {
    // We are on auth.risecorestudio.com
    // Redirect root "/" to "/login"
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/login", `https://${authDomain}`));
    }

    // Redirect marketing/stock pages from auth subdomain
    const marketingPaths = ["/about", "/showcase"];
    if (marketingPaths.some((path) => url.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL(url.pathname, `https://${mainDomain}`));
    }
  } else {
    // We are on the main domain risecorestudio.com (or any other domain/alias)
    // Redirect stock access to stock.risecorestudio.com
    if (url.pathname.startsWith("/stock")) {
      const stockPath = url.pathname.replace(/^\/stock/, "") || "/";
      return NextResponse.redirect(new URL(stockPath, "https://stock.risecorestudio.com"));
    }

    // Block portal, authentications, and request views on the main domain (no redirects)
    const portalPaths = [
      "/login",
      "/request",
      "/apply",
      "/portal",
      "/admin",
      "/board",
      "/projects",
      "/logs",
      "/workspace",
    ];

    if (portalPaths.some((path) => url.pathname.startsWith(path))) {
      url.pathname = "/404";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api (API routes)
     * 2. _next/static (static files)
     * 3. _next/image (image optimization files)
     * 4. favicon.ico, logo files (static public files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
