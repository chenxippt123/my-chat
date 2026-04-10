import { ConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { areFriends } from "@/lib/friendship";

export async function findDirectConversation(
  userA: string,
  userB: string,
): Promise<string | null> {
  const candidates = await prisma.conversation.findMany({
    where: {
      type: ConversationType.DIRECT,
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
    include: { members: true },
  });

  const twoMember = candidates.find((c) => c.members.length === 2);
  return twoMember?.id ?? null;
}

export async function ensureDirectConversation(
  currentUserId: string,
  friendId: string,
): Promise<{ conversationId: string; created: boolean }> {
  if (!(await areFriends(currentUserId, friendId))) {
    throw new Error("NOT_FRIENDS");
  }

  const existing = await findDirectConversation(currentUserId, friendId);
  if (existing) {
    return { conversationId: existing, created: false };
  }

  const conv = await prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      createdById: currentUserId,
      members: {
        create: [{ userId: currentUserId }, { userId: friendId }],
      },
    },
  });

  return { conversationId: conv.id, created: true };
}
