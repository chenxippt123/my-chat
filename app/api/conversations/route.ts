import { NextResponse } from "next/server";
import { ConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId } },
    },
    include: {
      members: {
        include: { user: { select: { id: true, username: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, username: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const payload = conversations.map((c) => {
    const last = c.messages[0];
    if (c.type === ConversationType.DIRECT) {
      const peer = c.members.map((m) => m.user).find((u) => u.id !== userId);
      return {
        id: c.id,
        type: c.type,
        title: peer?.username ?? "Direct",
        peer,
        lastMessage: last
          ? {
              id: last.id,
              body: last.body,
              createdAt: last.createdAt,
              sender: last.sender,
            }
          : null,
      };
    }
    return {
      id: c.id,
      type: c.type,
      title: c.name ?? "Group",
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt,
            sender: last.sender,
          }
        : null,
    };
  });

  return NextResponse.json({ conversations: payload });
}
