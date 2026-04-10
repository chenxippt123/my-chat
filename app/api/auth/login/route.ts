import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { jsonError } from "@/lib/http";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return jsonError("Invalid username or password", 401);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return jsonError("Invalid username or password", 401);
  }

  const token = await signSessionToken(user.id);
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, username: user.username },
  });
}
