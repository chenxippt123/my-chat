"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Conv = {
  id: string;
  type: string;
  title: string;
  lastMessage: {
    body: string;
    sender: { username: string };
  } | null;
};

export function ChatSidebar() {
  const pathname = usePathname();
  const [list, setList] = useState<Conv[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: Conv[] };
      if (!cancelled) setList(data.conversations);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Chats
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {list === null ? (
          <p className="px-2 py-3 text-sm text-zinc-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="px-2 py-3 text-sm text-zinc-500">No conversations yet.</p>
        ) : (
          <ul className="space-y-1">
            {list.map((c) => {
              const active = pathname === `/chat/${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/chat/${c.id}`}
                    className={`block rounded-md px-2 py-2 text-sm ${
                      active
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="font-medium">{c.title}</span>
                    {c.lastMessage ? (
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {c.lastMessage.sender.username}: {c.lastMessage.body}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div className="border-t border-zinc-200 p-2 text-xs text-zinc-500">
        <Link className="block rounded px-2 py-1 hover:bg-zinc-100" href="/friends">
          Friends
        </Link>
        <Link className="block rounded px-2 py-1 hover:bg-zinc-100" href="/groups/new">
          New group
        </Link>
      </div>
    </aside>
  );
}
