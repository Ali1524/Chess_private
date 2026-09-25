import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types/socket.js";
import type { GameManager } from "../game/GameManager.js";
import type { SocketRateLimiter } from "../middleware/rateLimit.js";
import {
  WebRTCOfferSchema,
  WebRTCAnswerSchema,
  WebRTCIceCandidateSchema,
} from "../validation/schemas.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerWebRTCSocket(
  io: TypedServer,
  socket: TypedSocket,
  gameManager: GameManager,
  rateLimiter: SocketRateLimiter
): void {

  function getValidatedOpponent(): string | null {
    const { roomId } = socket.data;
    if (!roomId) return null;

    // Verify sender is in the room
    if (!gameManager.validateRoomMembership(socket.id, roomId)) return null;

    // Get opponent socket - server validates, never trust client-supplied target
    return gameManager.getOpponentSocket(roomId, socket.id);
  }

  socket.on("webrtc:offer", (payload) => {
    if (!rateLimiter.isAllowed(socket.id, "webrtc:offer")) return;

    const parsed = WebRTCOfferSchema.safeParse(payload);
    if (!parsed.success) return;

    const opponentSocketId = getValidatedOpponent();
    if (!opponentSocketId) return;

    // Forward offer only to the validated opponent in the same room
    io.to(opponentSocketId).emit("webrtc:offer", parsed.data);
  });

  socket.on("webrtc:answer", (payload) => {
    if (!rateLimiter.isAllowed(socket.id, "webrtc:answer")) return;

    const parsed = WebRTCAnswerSchema.safeParse(payload);
    if (!parsed.success) return;

    const opponentSocketId = getValidatedOpponent();
    if (!opponentSocketId) return;

    io.to(opponentSocketId).emit("webrtc:answer", parsed.data);
  });

  socket.on("webrtc:ice-candidate", (payload) => {
    if (!rateLimiter.isAllowed(socket.id, "webrtc:ice-candidate")) return;

    const parsed = WebRTCIceCandidateSchema.safeParse(payload);
    if (!parsed.success) return;

    const opponentSocketId = getValidatedOpponent();
    if (!opponentSocketId) return;

    io.to(opponentSocketId).emit("webrtc:ice-candidate", parsed.data);
  });

  // When a socket disconnects, notify the opponent's WebRTC layer
  socket.on("disconnect", () => {
    const { roomId } = socket.data;
    if (!roomId) return;

    const opponentSocketId = gameManager.getOpponentSocket(roomId, socket.id);
    if (opponentSocketId) {
      io.to(opponentSocketId).emit("webrtc:peer:left");
    }
  });
}
