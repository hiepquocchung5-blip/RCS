import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = (request.headers.get("host") || "").toLowerCase();

  const mainDomain = "risecorestudio.com";
  const authDomain = "auth.risecorestudio.com";
  const devDomain = "developers.risecorestudio.com";
  const stockDomain = "stock.risecorestudio.com";

  // In development, ignore subdomain routing on localhost
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  if (isLocalhost) {
    return NextResponse.next();
  }

  const isAuthSubdomain = host.startsWith("auth.");
  const isDevSubdomain = host.startsWith("developers.");
  const isStockSubdomain = host.startsWith("stock.");

  // 1. Stock subdomain
  if (isStockSubdomain) {
    if (!url.pathname.startsWith("/stock")) {
      url.pathname = `/stock${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  }

  // 2. Auth subdomain (auth.risecorestudio.com)
  if (isAuthSubdomain) {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/login", `https://${authDomain}`));
    }
    // Dev hub routes on auth subdomain -> redirect to developers.risecorestudio.com
    const devPaths = ["/projects", "/board", "/admin", "/logs", "/workspace", "/portal"];
    if (devPaths.some((path) => url.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL(url.pathname, `https://${devDomain}`));
    }
    // Marketing routes on auth subdomain -> redirect to risecorestudio.com
    const marketingPaths = ["/about", "/showcase"];
    if (marketingPaths.some((path) => url.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL(url.pathname, `https://${mainDomain}`));
    }
    return NextResponse.next();
  }

  // 3. Developers subdomain (developers.risecorestudio.com)
  if (isDevSubdomain) {
    if (url.pathname === "/") {
      return NextResponse.redirect(new URL("/projects", `https://${devDomain}`));
    }
    // Auth routes on dev subdomain -> redirect to auth.risecorestudio.com
    const authPaths = ["/login", "/request", "/apply"];
    if (authPaths.some((path) => url.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL(url.pathname, `https://${authDomain}`));
    }
    return NextResponse.next();
  }

  // 4. Main domain (risecorestudio.com)
  if (url.pathname.startsWith("/stock")) {
    const stockPath = url.pathname.replace(/^\/stock/, "") || "/";
    return NextResponse.redirect(new URL(stockPath, `https://${stockDomain}`));
  }

  const authPaths = ["/login", "/request", "/apply"];
  if (authPaths.some((path) => url.pathname.startsWith(path))) {
    return NextResponse.redirect(new URL(url.pathname, `https://${authDomain}`));
  }

  const devPaths = ["/projects", "/board", "/admin", "/logs", "/workspace", "/portal"];
  if (devPaths.some((path) => url.pathname.startsWith(path))) {
    return NextResponse.redirect(new URL(url.pathname, `https://${devDomain}`));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
