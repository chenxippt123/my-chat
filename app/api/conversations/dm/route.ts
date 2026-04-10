import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/session";
import { jsonError } from "@/lib/http";
import { ensureDirectConversation } from "@/lib/conversation";

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

  try {
    const result = await ensureDirectConversation(userId, parsed.data.friendId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FRIENDS") {
      return jsonError("You can only chat with accepted friends", 403);
    }
    throw e;
  }
}
