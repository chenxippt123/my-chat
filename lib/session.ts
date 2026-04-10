import { cookies } from "next/headers";
import * as jose from "jose";
import { SESSION_COOKIE } from "./constants";

const alg = "HS256";

export function getJwtSecretBytes(): Uint8Array {
  const s =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "dev-only-secret-must-be-32-chars!!"
      : "");
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters in production");
  }
  return new TextEncoder().encode(s);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretBytes());
}

export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jose.jwtVerify(token, getJwtSecretBytes(), {
    algorithms: [alg],
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Invalid token");
  }
  return payload.sub;
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
