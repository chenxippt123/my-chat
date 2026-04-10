import type { Server as IOServer } from "socket.io";

/** Next may load this module in multiple bundles; use global so API routes see the same `io`. */
const GLOBAL_IO_KEY = "__mychat_socket_io__" as const;

type G = typeof globalThis & { [GLOBAL_IO_KEY]?: IOServer };

export function setSocketServer(instance: IOServer) {
  (globalThis as G)[GLOBAL_IO_KEY] = instance;
}

export function getSocketServer(): IOServer {
  const io = (globalThis as G)[GLOBAL_IO_KEY];
  if (!io) {
    throw new Error("Socket.io server is not initialized");
  }
  return io;
}

export function emitNewMessage(conversationId: string, payload: unknown) {
  try {
    getSocketServer().to(conversationId).emit("message:new", payload);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[mychat] emitNewMessage:", e);
    }
  }
}
