import { v4 as uuidv4 } from "uuid";
import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types/socket.js";
import type { GameManager } from "../game/GameManager.js";
import type { SocketRateLimiter } from "../middleware/rateLimit.js";
import { ChatMessageSchema } from "../validation/schemas.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

// Sanitize text to prevent XSS - strip HTML tags and dangerous characters
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function registerChatSocket(
  io: TypedServer,
  socket: TypedSocket,
  gameManager: GameManager,
  rateLimiter: SocketRateLimiter
): void {
  socket.on("chat:message", (payload) => {
    if (!rateLimiter.isAllowed(socket.id, "chat:message")) {
      socket.emit("chat:error", { code: "RATE_LIMITED", message: "Sending messages too fast." });
      return;
    }

    const parsed = ChatMessageSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("chat:error", {
        code: "INVALID_PAYLOAD",
        message: parsed.error.errors[0]?.message ?? "Invalid message",
      });
      return;
    }

    const { sessionId, roomId } = socket.data;
    if (!sessionId || !roomId) {
      socket.emit("chat:error", { code: "UNAUTHORIZED", message: "Not in a room." });
      return;
    }

    // Validate room membership
    if (!gameManager.validateRoomMembership(socket.id, roomId)) {
      socket.emit("chat:error", { code: "UNAUTHORIZED", message: "Not in this room." });
      return;
    }

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState) {
      socket.emit("chat:error", { code: "ROOM_NOT_FOUND", message: "Room not found." });
      return;
    }

    // Get player info
    const myPlayer =
      roomState.players.white?.playerId && socket.data.color === "w"
        ? roomState.players.white
        : roomState.players.black;

    if (!myPlayer) return;

    const chatMessage = {
      id: uuidv4(),
      playerId: myPlayer.playerId,
      displayName: sanitizeText(myPlayer.displayName),
      message: sanitizeText(parsed.data.message),
      timestamp: Date.now(),
    };

    // Broadcast to entire room (including sender for confirmation)
    io.to(roomId).emit("chat:message", chatMessage);
  });
}
