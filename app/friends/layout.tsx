import { AppHeader } from "@/components/AppHeader";
import Link from "next/link";

export default function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm">
        <Link href="/chat" className="text-blue-600 hover:underline">
          Back to chats
        </Link>
      </div>
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
