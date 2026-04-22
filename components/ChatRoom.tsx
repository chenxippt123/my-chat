"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { MessageBody } from "@/components/MessageBody";

type Sender = { id: string; username: string };

type ConvMeta = {
  type: "DIRECT" | "GROUP";
  name: string | null;
  assistantUsername: string;
  members: { id: string; username: string }[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  attachmentName: string | null;
  createdAt: string;
  sender: Sender;
};

export function ChatRoom({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [convMeta, setConvMeta] = useState<ConvMeta | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionPick, setMentionPick] = useState<{
    start: number;
    filter: string;
  } | null>(null);
  const [dissolving, setDissolving] = useState(false);

  const appendIncoming = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
    [],
  );

  const updateMentionFromCursor = useCallback(
    (value: string, cursorPos: number) => {
      if (convMeta?.type !== "GROUP") {
        setMentionPick(null);
        return;
      }
      const before = value.slice(0, cursorPos);
      const at = before.lastIndexOf("@");
      if (at === -1) {
        setMentionPick(null);
        return;
      }
      const prevChar = at > 0 ? before[at - 1] : "";
      if (at > 0 && !/\s/.test(prevChar)) {
        setMentionPick(null);
        return;
      }
      const frag = before.slice(at + 1);
      if (frag.includes(" ") || frag.includes("\n")) {
        setMentionPick(null);
        return;
      }
      setMentionPick({ start: at, filter: frag.toLowerCase() });
    },
    [convMeta?.type],
  );

  useEffect(() => {
    setConvMeta(null);
    setMentionPick(null);
    let cancelled = false;
    void (async () => {
      const [meRes, msgRes, convRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/conversations/${conversationId}/messages?limit=50`),
        fetch(`/api/conversations/${conversationId}`),
      ]);
      if (cancelled) return;
      if (meRes.ok) {
        const me = (await meRes.json()) as { user: { id: string } };
        setMyUserId(me.user.id);
      }
      if (convRes.ok) {
        const c = (await convRes.json()) as ConvMeta;
        setConvMeta(c);
      }
      if (msgRes.ok) {
        const data = (await msgRes.json()) as {
          messages: ChatMessage[];
          nextCursor: string | null;
        };
        setMessages(data.messages);
        setNextCursor(data.nextCursor);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    function joinRoom() {
      socket.emit("joinConversation", conversationId, (ok?: boolean) => {
        if (ok === false && process.env.NODE_ENV === "development") {
          console.warn("[mychat] joinConversation rejected for", conversationId);
        }
      });
    }

    socket.on("connect", joinRoom);
    socket.io.on("reconnect", joinRoom);

    socket.on("message:new", (msg: ChatMessage) => {
      if (msg.conversationId !== conversationId) return;
      appendIncoming(msg);
    });

    return () => {
      socket.emit("leaveConversation", conversationId);
      socket.off("connect", joinRoom);
      socket.io.off("reconnect", joinRoom);
      socket.disconnect();
    };
  }, [conversationId, appendIncoming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?cursor=${encodeURIComponent(
          nextCursor,
        )}&limit=50`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: ChatMessage[];
        nextCursor: string | null;
      };
      setMessages((prev) => [...data.messages, ...prev]);
      setNextCursor(data.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(payload: {
    body: string;
    attachmentUrl?: string | null;
    attachmentMime?: string | null;
    attachmentName?: string | null;
  }) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { message: ChatMessage };
    appendIncoming(data.message);
  }

  function insertMention(username: string) {
    const el = textareaRef.current;
    if (!el || mentionPick === null) return;
    const pos = el.selectionStart ?? text.length;
    const before = text.slice(0, mentionPick.start);
    const after = text.slice(pos);
    const next = `${before}@${username} ${after}`;
    setText(next);
    setMentionPick(null);
    queueMicrotask(() => {
      el.focus();
      const caret = before.length + username.length + 2;
      el.setSelectionRange(caret, caret);
    });
  }

  function onTextAreaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setText(v);
    updateMentionFromCursor(v, e.target.selectionStart ?? v.length);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    setMentionPick(null);
    await sendMessage({ body: trimmed });
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) return;
      const data = (await res.json()) as {
        url: string;
        mime: string;
        name: string;
      };
      await sendMessage({
        body: "",
        attachmentUrl: data.url,
        attachmentMime: data.mime,
        attachmentName: data.name,
      });
    } finally {
      setUploading(false);
    }
  }

  async function dissolveGroup() {
    if (!convMeta || convMeta.type !== "GROUP") return;
    if (
      !window.confirm(
        "Dissolve this group? All members will lose access and messages will be deleted.",
      )
    ) {
      return;
    }
    setDissolving(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "Could not dissolve group");
        return;
      }
      router.push("/chat");
      router.refresh();
    } finally {
      setDissolving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {convMeta?.type === "GROUP" ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2">
          <h2 className="truncate text-sm font-semibold text-zinc-900">
            {convMeta.name ?? "Group"}
          </h2>
          <button
            type="button"
            disabled={dissolving}
            onClick={() => void dissolveGroup()}
            className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {dissolving ? "…" : "Dissolve group"}
          </button>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {nextCursor ? (
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={loadingOlder}
            className="mb-3 text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        ) : null}
        <ul className="flex flex-col gap-3">
          {messages.map((m) => {
            const mine = myUserId !== null && m.sender.id === myUserId;
            return (
              <li
                key={m.id}
                className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(85%,28rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-md bg-zinc-900 text-zinc-50"
                      : "rounded-bl-md bg-zinc-100 text-zinc-900"
                  }`}
                >
                  {!mine ? (
                    <p className="mb-1 text-xs font-medium text-zinc-500">
                      {m.sender.username}
                    </p>
                  ) : null}
                  {m.body ? (
                    <MessageBody body={m.body} mine={mine} />
                  ) : null}
                  {m.attachmentUrl ? (
                    <div className={m.body ? "mt-2" : ""}>
                      {m.attachmentMime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.attachmentUrl}
                          alt={m.attachmentName ?? "attachment"}
                          className={`max-h-64 max-w-full rounded-lg ${
                            mine ? "border border-zinc-700" : "border border-zinc-200"
                          }`}
                        />
                      ) : (
                        <a
                          href={m.attachmentUrl}
                          className={
                            mine
                              ? "text-sky-300 underline hover:text-sky-200"
                              : "text-blue-600 underline"
                          }
                          download={m.attachmentName ?? true}
                        >
                          {m.attachmentName ?? "Download file"}
                        </a>
                      )}
                    </div>
                  ) : null}
                  <p
                    className={`mt-1 text-[11px] tabular-nums ${
                      mine ? "text-right text-zinc-400" : "text-zinc-400"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="flex items-end gap-2 border-t border-zinc-200 p-3"
      >
        <label className="shrink-0 cursor-pointer rounded border border-zinc-300 px-2 py-2 text-xs hover:bg-zinc-50">
          File
          <input type="file" className="hidden" onChange={(e) => void onFileChange(e)} />
        </label>
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            className="min-h-[40px] w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            rows={2}
            value={text}
            onChange={onTextAreaChange}
            onSelect={() => {
              const el = textareaRef.current;
              if (!el) return;
              updateMentionFromCursor(el.value, el.selectionStart ?? 0);
            }}
            onKeyUp={() => {
              const el = textareaRef.current;
              if (!el) return;
              updateMentionFromCursor(el.value, el.selectionStart ?? 0);
            }}
            placeholder={(() => {
              if (!convMeta) return "Write a message…";
              if (convMeta.type === "GROUP") {
                return `输入消息；@${convMeta.assistantUsername} 才会让助手回复。输入 @ 可选择成员。`;
              }
              const privateAssistant =
                convMeta.members.length === 2 &&
                convMeta.members.some(
                  (m) =>
                    m.username.toLowerCase() ===
                    convMeta.assistantUsername.toLowerCase(),
                );
              return privateAssistant
                ? "与助手私聊：可直接输入；也可 @ 助手。"
                : `输入消息；@${convMeta.assistantUsername} 才会让助手回复（含与好友的会话）。`;
            })()}
          />
          {mentionPick && convMeta ? (
            <ul
              className="absolute bottom-full left-0 z-10 mb-1 max-h-40 min-w-[10rem] overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg"
              role="listbox"
            >
              {convMeta.members
                .filter((m) =>
                  m.username.toLowerCase().startsWith(mentionPick.filter),
                )
                .map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertMention(m.username)}
                    >
                      @{m.username}
                    </button>
                  </li>
                ))}
              {convMeta.members.every(
                (m) => !m.username.toLowerCase().startsWith(mentionPick.filter),
              ) ? (
                <li className="px-3 py-1.5 text-zinc-400">无匹配成员</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {uploading ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
