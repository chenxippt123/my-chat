type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = { role: ChatRole; content: string };

/** DeepSeek 官方 API（OpenAI 兼容）：https://api.deepseek.com */
export async function completeChat(messages: ChatMessage[]): Promise<string> {
  const rawKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  const apiKey = rawKey.replace(/^["']|["']$/g, "").trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }

  const base =
    process.env.DEEPSEEK_BASE_URL?.replace(/\/$/, "") ??
    "https://api.deepseek.com/v1";
  const model =
    process.env.DEEPSEEK_MODEL?.trim() ?? "deepseek-chat";

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.6,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${raw.slice(0, 500)}`);
  }

  let data: {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("DeepSeek returned non-JSON");
  }

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("DeepSeek returned empty content");
  }

  return content;
}
