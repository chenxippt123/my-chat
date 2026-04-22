import { NextResponse } from "next/server";
import { ConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { getAssistantUsername } from "@/lib/assistant/config";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { id: conversationId } = await ctx.params;

  const member = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  if (!member) {
    return jsonError("Forbidden", 403);
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  if (!conv) {
    return jsonError("Not found", 404);
  }

  return NextResponse.json({
    id: conv.id,
    type: conv.type,
    name: conv.name,
    assistantUsername: getAssistantUsername(),
    members: conv.members.map((m) => ({
      id: m.user.id,
      username: m.user.username,
    })),
  });
}

/** 解散群聊：任意成员可删除整个会话（级联消息与成员）。 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { id: conversationId } = await ctx.params;

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: { select: { userId: true } },
    },
  });

  if (!conv) {
    return jsonError("Not found", 404);
  }
  if (conv.type !== ConversationType.GROUP) {
    return jsonError("Only group conversations can be dissolved here", 400);
  }
  if (!conv.members.some((m) => m.userId === userId)) {
    return jsonError("Forbidden", 403);
  }

  await prisma.conversation.delete({ where: { id: conversationId } });

  return NextResponse.json({ ok: true });
}
