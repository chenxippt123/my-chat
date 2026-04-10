import { NextResponse } from "next/server";
import { z } from "zod";
import { FriendshipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

const schema = z.object({
  requesterId: z.string().min(1),
  accept: z.boolean(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

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

  const { requesterId, accept } = parsed.data;

  const row = await prisma.friendship.findFirst({
    where: {
      userId: requesterId,
      friendId: userId,
      status: FriendshipStatus.PENDING,
    },
  });

  if (!row) {
    return jsonError("Request not found", 404);
  }

  await prisma.friendship.update({
    where: { id: row.id },
    data: { status: accept ? FriendshipStatus.ACCEPTED : FriendshipStatus.REJECTED },
  });

  return NextResponse.json({ ok: true });
}
