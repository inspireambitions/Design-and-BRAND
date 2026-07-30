import { NextResponse, type NextRequest } from "next/server";
import { BRAND } from "@/lib/brand";

// The tool is reachable only from the canonical host. Anything else — a Vercel
// preview URL, a bare IP, an alternate domain pointed at the same deployment —
// gets a 308 to the real address.
//
// Two reasons: the brand promise is that this lives on inspireambitions.com,
// and duplicate hosts serving identical content split ranking signals and can
// get the wrong URL indexed. Localhost and preview deployments are exempt so
// development and Vercel's own preview flow keep working.
const CANONICAL_HOST = BRAND.domain;

function isExempt(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    host.endsWith(".local") ||
    // Vercel preview deployments — reviewing a branch shouldn't bounce to prod.
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV !== "production"
  );
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (isExempt(host)) return NextResponse.next();

  const bare = host.split(":")[0].toLowerCase();
  if (bare === CANONICAL_HOST) return NextResponse.next();

  // www and any other alias fold into the canonical host, preserving the path
  // and query so a deep link survives the redirect.
  const url = req.nextUrl.clone();
  url.host = CANONICAL_HOST;
  url.protocol = "https";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Skip static assets and the icon so the redirect check runs only on real
  // page and API requests.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
