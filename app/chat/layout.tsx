import { ChatSidebar } from "@/components/ChatSidebar";
import { AppHeader } from "@/components/AppHeader";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <ChatSidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
