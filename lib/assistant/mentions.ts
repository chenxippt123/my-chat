import { getAssistantUsername } from "@/lib/assistant/config";

/** 全角 ＠ (U+FF03) 等与半角 @ 等价，便于中文输入法下的 @ 检测 */
function normalizeMentionText(body: string): string {
  return body.replace(/\uFF03/g, "@");
}

/** True if `body` contains a mention of `username` as @username (case-insensitive, word boundary after name). */
export function messageMentionsUsername(body: string, username: string): boolean {
  const u = username.trim();
  if (!u) return false;
  const normalized = normalizeMentionText(body);
  const esc = u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\w])@${esc}\\b`, "i");
  return re.test(normalized);
}

export function messageMentionsAssistant(body: string): boolean {
  return messageMentionsUsername(body, getAssistantUsername());
}

/** For highlighting: split text into alternating plain and @mention segments. */
export function parseMentionSegments(body: string): { text: string; isMention: boolean }[] {
  if (!body) return [];
  const normalized = normalizeMentionText(body);
  const re = /(@[a-zA-Z0-9_]+)/g;
  const out: { text: string; isMention: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    if (m.index > last) {
      out.push({ text: normalized.slice(last, m.index), isMention: false });
    }
    out.push({ text: m[1], isMention: true });
    last = m.index + m[1].length;
  }
  if (last < normalized.length) {
    out.push({ text: normalized.slice(last), isMention: false });
  }
  return out.length ? out : [{ text: normalized, isMention: false }];
}
