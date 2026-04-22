import "./lib/next-als-polyfill";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import * as cookie from "cookie";
import { setSocketServer } from "./lib/socket";
import { verifySessionToken } from "./lib/session";
import { prisma } from "./lib/prisma";
import { SESSION_COOKIE } from "./lib/constants";
import { ensureAssistantUser } from "./lib/assistant/seed";

const dev = process.env.NODE_ENV !== "production";
/** Passed to Next (HMR / dev server metadata). */
const nextHostname = process.env.HOSTNAME ?? "localhost";
/** TCP bind address: use 0.0.0.0 to allow LAN access (e.g. http://192.168.x.x:3000). */
const listenHost = process.env.LISTEN_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname: nextHostname, port, dir: "." });
const handle = app.getRequestHandler();

const socketCorsOrigin =
  dev ||
  !process.env.SOCKETIO_CORS_ORIGIN ||
  process.env.SOCKETIO_CORS_ORIGIN.trim() === ""
    ? true
    : process.env.SOCKETIO_CORS_ORIGIN.split(",")
        .map((s) => s.trim())
        .filter(Boolean);

app.prepare().then(async () => {
  try {
    await ensureAssistantUser();
  } catch (e) {
    console.warn("[my-chat] ensureAssistantUser failed (DB up? migrated?):", e);
  }

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    void handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      // Dev: allow localhost + LAN IPs. Prod: set SOCKETIO_CORS_ORIGIN to your site URL(s).
      origin: socketCorsOrigin,
      credentials: true,
    },
  });

  setSocketServer(io);

  io.use(async (socket, next) => {
    try {
      const raw = socket.request.headers.cookie;
      if (!raw) {
        next(new Error("Unauthorized"));
        return;
      }
      const parsed = cookie.parse(raw);
      const token = parsed[SESSION_COOKIE];
      if (!token) {
        next(new Error("Unauthorized"));
        return;
      }
      const userId = await verifySessionToken(token);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    socket.on("joinConversation", async (conversationId: string, cb?: (ok: boolean) => void) => {
      try {
        const member = await prisma.conversationMember.findFirst({
          where: { conversationId, userId },
        });
        if (member) {
          await socket.join(conversationId);
          cb?.(true);
        } else {
          cb?.(false);
        }
      } catch {
        cb?.(false);
      }
    });

    socket.on("leaveConversation", (conversationId: string) => {
      void socket.leave(conversationId);
    });
  });

  httpServer.listen(port, listenHost, () => {
    const local = `http://localhost:${port}`;
    const bindHint =
      listenHost === "0.0.0.0"
        ? ` (bound on 0.0.0.0:${port} — use your machine’s LAN IP from other devices)`
        : "";
    console.log(`> Ready on ${local}${bindHint}`);
  });
});
