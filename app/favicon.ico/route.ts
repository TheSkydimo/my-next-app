import { NextResponse } from "next/server";

export function GET() {
	// Browsers still request `/favicon.ico` by default.
	// Our actual icon asset lives at `/favicon.png` (served from `public/`).
	// Redirecting avoids maintaining an .ico binary in the repo.
	const res = NextResponse.redirect(new URL("/favicon.png", "http://localhost"), 308);
	// Safe to cache aggressively (public, immutable) since favicon changes are rare.
	res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
	return res;
}


