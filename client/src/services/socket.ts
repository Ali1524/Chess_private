import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "");

let socket: AppSocket | null = null;

function attachConnectionDiagnostics(s: AppSocket): AppSocket {
  s.on("connect_error", (error) => {
    console.error("Socket connection failed:", error.message);
  });

  s.on("disconnect", (reason) => {
    console.warn("Socket disconnected:", reason);
  });

  return s;
}

export function getSocket(): AppSocket {
  if (!socket) {
    socket = attachConnectionDiagnostics(
      io(SOCKET_URL || "http://localhost:3001", {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        transports: ["websocket", "polling"],
      })
    );
  }
  return socket;
}

export function connectSocket(): AppSocket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
