"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; username: string };

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [friends, setFriends] = useState<{ id: string; user: User }[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    const res = await fetch("/api/friends");
    if (!res.ok) return;
    const data = (await res.json()) as { friends: { id: string; user: User }[] };
    setFriends(data.friends);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadFriends());
  }, [loadFriends]);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const memberIds = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    if (memberIds.length === 0) {
      setError("Select at least one friend");
      return;
    }
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), memberIds }),
    });
    const data = (await res.json()) as { error?: string; id?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not create group");
      return;
    }
    if (data.id) {
      router.push(`/chat/${data.id}`);
    }
  }

  return (
    <main>
      <h1 className="text-xl font-semibold text-zinc-900">New group</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Pick a name and choose friends (accepted only).
      </p>
      <form onSubmit={(e) => void createGroup(e)} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-zinc-800">Group name</label>
          <input
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800">Members</p>
          {friends.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Add friends first.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
              {friends.map((f) => (
                <li key={f.user.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    id={`m-${f.user.id}`}
                    type="checkbox"
                    checked={!!selected[f.user.id]}
                    onChange={() => toggle(f.user.id)}
                  />
                  <label htmlFor={`m-${f.user.id}`} className="cursor-pointer">
                    {f.user.username}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Create group
        </button>
      </form>
    </main>
  );
}
