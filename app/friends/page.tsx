"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; username: string };

export default function FriendsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<User[]>([]);
  const [friends, setFriends] = useState<{ id: string; user: User }[]>([]);
  const [incoming, setIncoming] = useState<{ id: string; from: User }[]>([]);
  const [outgoing, setOutgoing] = useState<{ id: string; to: User }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/friends");
    if (!res.ok) return;
    const data = (await res.json()) as {
      friends: { id: string; user: User }[];
      incoming: { id: string; from: User }[];
      outgoing: { id: string; to: User }[];
    };
    setFriends(data.friends);
    setIncoming(data.incoming);
    setOutgoing(data.outgoing);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  useEffect(() => {
    if (q.trim().length < 2) {
      queueMicrotask(() => setHits([]));
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { users: User[] };
        setHits(data.users);
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function sendRequest(friendId: string) {
    setError(null);
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Request failed");
      return;
    }
    await refresh();
  }

  async function respond(requesterId: string, accept: boolean) {
    setError(null);
    const res = await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requesterId, accept }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not update request");
      return;
    }
    await refresh();
  }

  async function openDm(friendId: string) {
    const res = await fetch("/api/conversations/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { conversationId: string };
    router.push(`/chat/${data.conversationId}`);
  }

  async function removeFriend(friendId: string, username: string) {
    if (
      !window.confirm(
        `Remove ${username} from friends? Your direct chat with them will be deleted.`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not remove friend");
      return;
    }
    await refresh();
  }

  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold text-zinc-900">Friends</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Search by username, send requests, and chat once accepted.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800">Find people</h2>
        <input
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Search (min 2 characters)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {hits.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
            {hits.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>{u.username}</span>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                  onClick={() => void sendRequest(u.id)}
                >
                  Add friend
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {incoming.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">Incoming requests</h2>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <span>{r.from.username}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-zinc-900 px-2 py-1 text-xs text-white"
                    onClick={() => void respond(r.from.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-xs"
                    onClick={() => void respond(r.from.id, false)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">Pending sent</h2>
          <ul className="text-sm text-zinc-600">
            {outgoing.map((r) => (
              <li key={r.id}>{r.to.username}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-800">Your friends</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-zinc-500">No friends yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>{f.user.username}</span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                    onClick={() => void openDm(f.user.id)}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() => void removeFriend(f.user.id, f.user.username)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
