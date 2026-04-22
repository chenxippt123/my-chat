import { NextResponse } from "next/server";
import { ConversationType, FriendshipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const accepted = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ userId }, { friendId: userId }],
    },
    include: {
      user: { select: { id: true, username: true } },
      friend: { select: { id: true, username: true } },
    },
  });

  const friends = accepted.map((f) => {
    const other = f.userId === userId ? f.friend : f.user;
    return { id: f.id, user: other };
  });

  const incoming = await prisma.friendship.findMany({
    where: { friendId: userId, status: FriendshipStatus.PENDING },
    include: { user: { select: { id: true, username: true } } },
  });

  const outgoing = await prisma.friendship.findMany({
    where: { userId, status: FriendshipStatus.PENDING },
    include: { friend: { select: { id: true, username: true } } },
  });

  return NextResponse.json({
    friends,
    incoming: incoming.map((r) => ({
      id: r.id,
      from: r.user,
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      to: r.friend,
    })),
  });
}

/** 删除好友关系，并删除双方之间的私聊会话（含消息）。 */
export async function DELETE(req: Request) {
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

  const friendId =
    typeof body === "object" &&
    body !== null &&
    "friendId" in body &&
    typeof (body as { friendId: unknown }).friendId === "string"
      ? (body as { friendId: string }).friendId.trim()
      : "";

  if (!friendId) {
    return jsonError("friendId required", 400);
  }
  if (friendId === userId) {
    return jsonError("Invalid friendId", 400);
  }

  const row = await prisma.friendship.findFirst({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });

  if (!row) {
    return jsonError("Not friends", 404);
  }

  const directBetween = await prisma.conversation.findMany({
    where: {
      type: ConversationType.DIRECT,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: friendId } } },
      ],
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (directBetween.length > 0) {
      await tx.conversation.deleteMany({
        where: { id: { in: directBetween.map((c) => c.id) } },
      });
    }
    await tx.friendship.delete({ where: { id: row.id } });
  });

  return NextResponse.json({ ok: true });
}
