import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { emitNewMessage } from "@/lib/socket";
import { scheduleAssistantReply } from "@/lib/assistant/reply";

const postSchema = z.object({
  body: z.string().max(8000).optional().default(""),
  attachmentUrl: z.string().max(2000).optional().nullable(),
  attachmentMime: z.string().max(200).optional().nullable(),
  attachmentName: z.string().max(500).optional().nullable(),
});

async function assertMember(conversationId: string, userId: string) {
  const m = await prisma.conversationMember.findFirst({
    where: { conversationId, userId },
  });
  return !!m;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { id: conversationId } = await ctx.params;
  if (!(await assertMember(conversationId, userId))) {
    return jsonError("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const take = Math.min(Number(searchParams.get("limit") ?? "40") || 40, 100);

  const cursorMsg = cursor
    ? await prisma.message.findUnique({ where: { id: cursor } })
    : null;

  const batch = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursorMsg
        ? { createdAt: { lt: cursorMsg.createdAt } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { sender: { select: { id: true, username: true } } },
  });

  const chronological = [...batch].reverse();
  const nextCursor =
    batch.length === take ? (chronological[0]?.id ?? null) : null;

  return NextResponse.json({
    messages: chronological,
    nextCursor,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const { id: conversationId } = await ctx.params;
  if (!(await assertMember(conversationId, userId))) {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }

  const { body: text, attachmentUrl, attachmentMime, attachmentName } = parsed.data;
  if (!text.trim() && !attachmentUrl) {
    return jsonError("Message cannot be empty", 400);
  }

  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      body: text ?? "",
      attachmentUrl: attachmentUrl ?? undefined,
      attachmentMime: attachmentMime ?? undefined,
      attachmentName: attachmentName ?? undefined,
    },
    include: { sender: { select: { id: true, username: true } } },
  });

  const out = {
    id: msg.id,
    conversationId: msg.conversationId,
    body: msg.body,
    attachmentUrl: msg.attachmentUrl,
    attachmentMime: msg.attachmentMime,
    attachmentName: msg.attachmentName,
    createdAt: msg.createdAt,
    sender: msg.sender,
  };

  emitNewMessage(conversationId, out);

  scheduleAssistantReply(conversationId);

  return NextResponse.json({ message: out });
}
