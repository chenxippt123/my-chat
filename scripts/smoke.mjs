/**
 * API smoke test. Requires a running server:
 *   npm run dev
 * In another terminal:
 *   npm run test:smoke
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function extractSessionCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader];
  for (const line of parts) {
    const m = /^mychat_session=([^;]+)/.exec(line);
    if (m) return `mychat_session=${m[1]}`;
  }
  return "";
}

async function main() {
  const u1 = `s${Date.now()}a`;
  const u2 = `s${Date.now()}b`;

  async function post(path, body, cookie = "") {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    const rawSet =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie");
    const nextCookie = extractSessionCookie(rawSet);
    if (!res.ok) {
      throw new Error(`POST ${path} -> ${res.status}: ${text}`);
    }
    return { json, cookie: nextCookie || cookie };
  }

  async function get(path, cookie) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie },
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    if (!res.ok) {
      throw new Error(`GET ${path} -> ${res.status}: ${text}`);
    }
    return json;
  }

  let c1 = "";
  let c2 = "";

  const r1 = await post(
    "/api/auth/register",
    {
      username: u1,
      password: "pass123456",
      registrationCode: "6688",
    },
    c1,
  );
  c1 = r1.cookie;
  const r2 = await post(
    "/api/auth/register",
    {
      username: u2,
      password: "pass123456",
      registrationCode: "6688",
    },
    c2,
  );
  c2 = r2.cookie;

  const id1 = r1.json.user.id;
  const id2 = r2.json.user.id;

  await post("/api/friends/request", { friendId: id2 }, c1);
  await post("/api/friends/respond", { requesterId: id1, accept: true }, c2);

  const dmRes = await post("/api/conversations/dm", { friendId: id2 }, c1);
  const { conversationId } = dmRes.json;

  const msgRes = await post(
    `/api/conversations/${conversationId}/messages`,
    { body: "smoke" },
    c1,
  );
  if (!msgRes.json.message?.id) throw new Error("missing message");

  const list = await get(
    `/api/conversations/${conversationId}/messages?limit=5`,
    c1,
  );
  if (!Array.isArray(list.messages) || list.messages.length < 1) {
    throw new Error("messages list empty");
  }

  console.log("smoke OK:", { users: [u1, u2], conversationId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
