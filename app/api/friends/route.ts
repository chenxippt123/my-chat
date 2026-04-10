import { NextResponse } from "next/server";
import { FriendshipStatus } from "@prisma/client";
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
