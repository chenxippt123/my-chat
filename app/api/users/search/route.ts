import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      username: { contains: q, mode: "insensitive" },
    },
    select: { id: true, username: true },
    take: 20,
  });

  return NextResponse.json({ users });
}
