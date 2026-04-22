import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signSessionToken, setSessionCookie } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { isReservedUsername } from "@/lib/assistant/config";

const schema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128),
  registrationCode: z.string().min(1),
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

  const { username, password, registrationCode } = parsed.data;
  if (isReservedUsername(username)) {
    return jsonError("This username is reserved", 400);
  }
  const expected = process.env.REGISTRATION_CODE;
  if (!expected || registrationCode !== expected) {
    return jsonError("Invalid registration code", 403);
  }

  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return jsonError("Username already taken", 409);
    }

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
      },
    });

    const token = await signSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, username: user.username },
    });
  } catch {
    return jsonError("Registration failed", 500);
  }
}
