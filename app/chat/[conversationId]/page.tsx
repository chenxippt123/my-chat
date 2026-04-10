import { ChatRoom } from "@/components/ChatRoom";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatRoom conversationId={conversationId} />;
}
