import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";
import { SESSION_COOKIE } from "./lib/constants";

const alg = "HS256";

function secretKey() {
  const s =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-only-secret-must-be-32-chars!!"
      : "");
  if (!s || s.length < 32) {
    return null;
  }
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const key = secretKey();
  if (!key) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jose.jwtVerify(token, key, { algorithms: [alg] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/chat/:path*", "/friends/:path*", "/groups/:path*"],
};
