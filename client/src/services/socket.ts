import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3001";

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ["websocket", "polling"],
    });
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
