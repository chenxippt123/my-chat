import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getAssistantUsername } from "@/lib/assistant/config";

/**
 * Idempotent: ensures one assistant user with reserved username exists.
 * Call after DB is reachable (e.g. from custom server after next.prepare()).
 */
export async function ensureAssistantUser(): Promise<void> {
  const username = getAssistantUsername();

  const named = await prisma.user.findUnique({ where: { username } });
  if (named) {
    if (!named.isAssistant) {
      await prisma.user.update({
        where: { id: named.id },
        data: { isAssistant: true },
      });
    }
    return;
  }

  const otherBot = await prisma.user.findFirst({
    where: { isAssistant: true },
  });
  if (otherBot) {
    await prisma.user.update({
      where: { id: otherBot.id },
      data: { username },
    });
    return;
  }

  const secret = randomBytes(32).toString("hex");
  await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(secret),
      isAssistant: true,
    },
  });
}

export async function getAssistantUserId(): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { isAssistant: true },
    select: { id: true },
  });
  return u?.id ?? null;
}

/** 将助手账号加入会话，否则无法代表助手发消息（幂等）。 */
export async function ensureAssistantInConversation(
  conversationId: string,
): Promise<string | null> {
  const assistantId = await getAssistantUserId();
  if (!assistantId) return null;

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: { conversationId, userId: assistantId },
    },
    create: { conversationId, userId: assistantId },
    update: {},
  });

  return assistantId;
}
