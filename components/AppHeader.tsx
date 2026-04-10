"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AppHeader() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = (await res.json()) as { user: { username: string } };
      if (!cancelled) setUsername(data.user.username);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <Link href="/chat" className="text-sm font-semibold text-zinc-900">
        my-chat
      </Link>
      <div className="flex items-center gap-3 text-sm text-zinc-700">
        {username ? <span>{username}</span> : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
