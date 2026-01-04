import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Default landing page:
 * - Visiting `/` should not render the old "home" content.
 * - Permanently redirect to `/orders` (301) as the app entry.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/orders", request.url), 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};


