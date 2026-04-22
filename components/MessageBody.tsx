"use client";

import { parseMentionSegments } from "@/lib/assistant/mentions";

export function MessageBody({
  body,
  mine,
}: {
  body: string;
  mine: boolean;
}) {
  const segments = parseMentionSegments(body);
  return (
    <p className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) =>
        seg.isMention ? (
          <span
            key={i}
            className={
              mine
                ? "font-medium text-sky-200"
                : "font-medium text-blue-700"
            }
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
