import { FriendshipStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function areFriends(aId: string, bId: string): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [
        { userId: aId, friendId: bId },
        { userId: bId, friendId: aId },
      ],
    },
  });
  return !!row;
}
