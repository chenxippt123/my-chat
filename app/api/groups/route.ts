import { NextResponse } from "next/server";
import { z } from "zod";
import { ConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { areFriends } from "@/lib/friendship";

const schema = z.object({
  name: z.string().min(1).max(64),
  memberIds: z.array(z.string()).max(50),
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

  const { name, memberIds } = parsed.data;
  const uniqueMembers = [...new Set(memberIds)].filter((id) => id !== userId);

  for (const mid of uniqueMembers) {
    if (!(await areFriends(userId, mid))) {
      return jsonError("You can only invite accepted friends", 403);
    }
  }

  const conv = await prisma.conversation.create({
    data: {
      type: ConversationType.GROUP,
      name,
      createdById: userId,
      members: {
        create: [
          { userId },
          ...uniqueMembers.map((id) => ({ userId: id })),
        ],
      },
    },
  });

  return NextResponse.json({ id: conv.id });
}
