import { after } from "next/server";
import { ConversationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitNewMessage } from "@/lib/socket";
import { completeChat, type ChatMessage } from "@/lib/assistant/deepseek";
import { getAssistantUsername } from "@/lib/assistant/config";
import { messageMentionsAssistant } from "@/lib/assistant/mentions";
import { ensureAssistantInConversation } from "@/lib/assistant/seed";

const lastReplyAt = new Map<string, number>();
const THROTTLE_MS = 2000;

function shouldThrottle(conversationId: string): boolean {
  const now = Date.now();
  const prev = lastReplyAt.get(conversationId) ?? 0;
  if (now - prev < THROTTLE_MS) return true;
  lastReplyAt.set(conversationId, now);
  return false;
}

function buildMessages(
  rows: {
    body: string;
    attachmentUrl: string | null;
    attachmentName: string | null;
    sender: { isAssistant: boolean };
  }[],
): ChatMessage[] {
  const system: ChatMessage = {
    role: "system",
    content: `You are “${getAssistantUsername()}”, a helpful assistant in a chat app. Reply concisely. Match the user's language when reasonable.`,
  };
  const rest: ChatMessage[] = rows.map((m) => {
    const text = m.body?.trim() ?? "";
    const extra =
      m.attachmentUrl && !text
        ? `[User sent a file: ${m.attachmentName ?? "attachment"}]`
        : m.attachmentUrl
          ? `${text}\n[Also attached: ${m.attachmentName ?? "file"}]`
          : text;
    return {
      role: m.sender.isAssistant ? "assistant" : "user",
      content: extra || "(empty message)",
    };
  });
  return [system, ...rest];
}

/** 仅两人且其一为助手：与助手私聊，不必 @；群聊或三人私聊仍需 @。 */
async function isAssistantPrivateDm(conversationId: string): Promise<boolean> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { type: true },
  });
  if (conv?.type !== ConversationType.DIRECT) return false;

  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    include: { user: { select: { isAssistant: true } } },
  });
  if (members.length !== 2) return false;

  return members.some((m) => m.user.isAssistant);
}

async function saveAndEmitAssistantMessage(
  conversationId: string,
  assistantId: string,
  body: string,
) {
  const msg = await prisma.message.create({
    data: {
      conversationId,
      senderId: assistantId,
      body,
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
}

async function runAssistantReply(conversationId: string): Promise<void> {
  const assistantId = await ensureAssistantInConversation(conversationId);
  if (!assistantId) return;

  const lastMsg = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    include: { sender: { select: { isAssistant: true } } },
  });

  if (!lastMsg || lastMsg.sender.isAssistant) return;

  const text = lastMsg.body?.trim() ?? "";
  const hasAtt = !!lastMsg.attachmentUrl;

  const privateWithAssistant = await isAssistantPrivateDm(conversationId);
  const needsMention = !privateWithAssistant;

  if (needsMention && !messageMentionsAssistant(text)) {
    return;
  }

  if (!text && hasAtt && needsMention) {
    return;
  }

  if (!text && !hasAtt) return;

  // 仅在确定会调用模型时节流，避免普通聊天消息占用冷却导致下一条 @ 助手 被吞
  if (shouldThrottle(conversationId)) return;

  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    console.warn("[assistant] DEEPSEEK_API_KEY missing; skip LLM reply");
    return;
  }

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { sender: { select: { isAssistant: true } } },
  });

  const chronological = [...history].reverse();
  const messages = buildMessages(chronological);

  try {
    const replyText = await completeChat(messages);
    await saveAndEmitAssistantMessage(conversationId, assistantId, replyText);
  } catch (e) {
    console.error("[assistant] DeepSeek failed:", e);
    try {
      await saveAndEmitAssistantMessage(
        conversationId,
        assistantId,
        "抱歉，助手暂时无法回复，请稍后再试。",
      );
    } catch (e2) {
      console.error("[assistant] fallback message failed:", e2);
    }
  }
}

/** Fire-and-forget：在响应发送后再跑，避免 Next 提前结束请求导致助手逻辑未执行。 */
export function scheduleAssistantReply(conversationId: string): void {
  after(() => {
    void runAssistantReply(conversationId).catch((e) => {
      console.error("[assistant] runAssistantReply:", e);
    });
  });
}
