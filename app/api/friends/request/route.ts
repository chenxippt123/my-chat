import { NextResponse } from "next/server";
import { z } from "zod";
import { FriendshipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

const schema = z.object({
  friendId: z.string().min(1),
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

  const { friendId } = parsed.data;
  if (friendId === userId) {
    return jsonError("Cannot add yourself", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: friendId } });
  if (!target) {
    return jsonError("User not found", 404);
  }

  if (target.isAssistant) {
    const existingPair = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
    if (existingPair?.status === FriendshipStatus.ACCEPTED) {
      return jsonError("Already friends", 409);
    }
    if (existingPair) {
      const updated = await prisma.friendship.update({
        where: { id: existingPair.id },
        data: { status: FriendshipStatus.ACCEPTED },
      });
      return NextResponse.json({ ok: true, id: updated.id });
    }
    const created = await prisma.friendship.create({
      data: {
        userId,
        friendId,
        status: FriendshipStatus.ACCEPTED,
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === FriendshipStatus.ACCEPTED) {
      return jsonError("Already friends", 409);
    }
    if (existing.status === FriendshipStatus.PENDING) {
      if (existing.userId === userId) {
        return jsonError("Request already sent", 409);
      }
      return jsonError("This user already sent you a request — accept it from incoming", 409);
    }
    if (existing.status === FriendshipStatus.REJECTED) {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          userId,
          friendId,
          status: FriendshipStatus.PENDING,
        },
      });
      return NextResponse.json({ ok: true, id: existing.id });
    }
  }

  const created = await prisma.friendship.create({
    data: { userId, friendId, status: FriendshipStatus.PENDING },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
