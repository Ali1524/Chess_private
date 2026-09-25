import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "../types/socket.js";
import type { GameManager } from "../game/GameManager.js";
import type { SocketRateLimiter } from "../middleware/rateLimit.js";
import {
  RoomCreateSchema,
  RoomJoinSchema,
  GameMoveSchema,
  GameResignSchema,
  DrawRespondSchema,
  GameSyncSchema,
} from "../validation/schemas.js";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export function registerGameSocket(
  io: TypedServer,
  socket: TypedSocket,
  gameManager: GameManager,
  rateLimiter: SocketRateLimiter
): void {

  function sendError(event: "room:error" | "game:error", code: string, message: string): void {
    socket.emit(event, { code, message });
  }

  function checkRate(event: string): boolean {
    if (!rateLimiter.isAllowed(socket.id, event)) {
      sendError("game:error", "RATE_LIMITED", "Too many requests. Slow down.");
      return false;
    }
    return true;
  }

  // ─── room:create ───────────────────────────────────────────────────────────

  socket.on("room:create", (payload) => {
    if (!checkRate("room:create")) return;

    const parsed = RoomCreateSchema.safeParse(payload);
    if (!parsed.success) {
      sendError("room:error", "INVALID_PAYLOAD", parsed.error.errors[0]?.message ?? "Invalid payload");
      return;
    }

    const { displayName, timeControl } = parsed.data;
    const result = gameManager.createRoom(socket.id, displayName, timeControl);

    socket.join(result.roomId);
    socket.data.sessionId = result.sessionId;
    socket.data.roomId = result.roomId;
    socket.data.color = result.color;

    socket.emit("room:created", {
      roomId: result.roomId,
      sessionId: result.sessionId,
      color: result.color,
    });
  });

  // ─── room:join ─────────────────────────────────────────────────────────────

  socket.on("room:join", (payload) => {
    if (!checkRate("room:join")) return;

    const parsed = RoomJoinSchema.safeParse(payload);
    if (!parsed.success) {
      sendError("room:error", "INVALID_PAYLOAD", parsed.error.errors[0]?.message ?? "Invalid payload");
      return;
    }

    const { roomId, displayName, sessionId } = parsed.data;

    const result = gameManager.joinRoom(socket.id, roomId, displayName, sessionId);

    if (!result.success || !result.sessionId || !result.color) {
      sendError("room:error", result.error ?? "SERVER_ERROR", getErrorMessage(result.error ?? "SERVER_ERROR"));
      return;
    }

    socket.join(roomId);
    socket.data.sessionId = result.sessionId;
    socket.data.roomId = roomId;
    socket.data.color = result.color;

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState) {
      sendError("room:error", "SERVER_ERROR", "Could not load room state");
      return;
    }

    socket.emit("room:joined", {
      roomId,
      sessionId: result.sessionId,
      color: result.color,
      roomState,
    });

    // Notify opponent
    if (!result.isReconnection) {
      // Broadcast full room state to all in room
      io.to(roomId).emit("game:state", roomState);

      // Notify opponent of new player
      const newPlayerInfo = result.color === "b" ? roomState.players.black : roomState.players.white;
      if (newPlayerInfo) {
        socket.to(roomId).emit("player:connected", {
          playerId: newPlayerInfo.playerId,
          color: newPlayerInfo.color,
          connected: true,
          displayName: newPlayerInfo.displayName,
        });
      }
    } else {
      // Reconnection: send full sync to reconnected player
      socket.emit("game:sync:response", roomState);

      // Notify opponent
      const reconnectedPlayer = result.color === "w" ? roomState.players.white : roomState.players.black;
      if (reconnectedPlayer) {
        socket.to(roomId).emit("player:connected", {
          playerId: reconnectedPlayer.playerId,
          color: reconnectedPlayer.color,
          connected: true,
          displayName: reconnectedPlayer.displayName,
        });
      }
    }
  });

  // ─── game:move ─────────────────────────────────────────────────────────────

  socket.on("game:move", async (payload) => {
    if (!checkRate("game:move")) return;

    const parsed = GameMoveSchema.safeParse(payload);
    if (!parsed.success) {
      sendError("game:error", "INVALID_PAYLOAD", parsed.error.errors[0]?.message ?? "Invalid payload");
      return;
    }

    const { from, to, promotion, expectedSequence } = parsed.data;
    const { sessionId, roomId } = socket.data;

    if (!sessionId || !roomId) {
      sendError("game:error", "UNAUTHORIZED", "Not in a room");
      return;
    }

    const result = await gameManager.makeMove(sessionId, roomId, from, to, promotion, expectedSequence);

    if (!result.success || !result.newChessState || !result.clockState) {
      sendError("game:error", result.error ?? "INVALID_MOVE", getErrorMessage(result.error ?? "INVALID_MOVE"));
      return;
    }

    // Broadcast accepted move to all in room
    io.to(roomId).emit("game:move:accepted", {
      chess: result.newChessState,
      clock: result.clockState,
      move: {
        from,
        to,
        san: result.san ?? "",
        promotion,
      },
    });

    // If game is over, broadcast result
    if (result.gameResult) {
      io.to(roomId).emit("game:finished", {
        result: result.gameResult,
        chess: result.newChessState,
        clock: result.clockState,
      });
    }
  });

  // ─── game:resign ───────────────────────────────────────────────────────────

  socket.on("game:resign", (payload) => {
    if (!checkRate("game:resign")) return;

    const parsed = GameResignSchema.safeParse(payload);
    if (!parsed.success) {
      sendError("game:error", "INVALID_PAYLOAD", "Invalid resign payload");
      return;
    }

    const { sessionId, roomId } = socket.data;
    if (!sessionId || !roomId) {
      sendError("game:error", "UNAUTHORIZED", "Not in a room");
      return;
    }

    const result = gameManager.resign(sessionId, roomId);
    if (!result.success || !result.result) {
      sendError("game:error", result.error ?? "SERVER_ERROR", getErrorMessage(result.error ?? "SERVER_ERROR"));
      return;
    }

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState) return;

    io.to(roomId).emit("game:finished", {
      result: result.result,
      chess: roomState.chess,
      clock: roomState.clock,
    });
  });

  // ─── game:draw:offer ───────────────────────────────────────────────────────

  socket.on("game:draw:offer", () => {
    if (!checkRate("game:draw:offer")) return;

    const { sessionId, roomId } = socket.data;
    if (!sessionId || !roomId) return;

    const result = gameManager.offerDraw(sessionId, roomId);
    if (!result.success) {
      sendError("game:error", result.error ?? "SERVER_ERROR", getErrorMessage(result.error ?? "SERVER_ERROR"));
      return;
    }

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState?.drawOffer) return;

    // Notify opponent of draw offer
    socket.to(roomId).emit("game:draw:offered", roomState.drawOffer);
  });

  // ─── game:draw:respond ─────────────────────────────────────────────────────

  socket.on("game:draw:respond", (payload) => {
    const parsed = DrawRespondSchema.safeParse(payload);
    if (!parsed.success) {
      sendError("game:error", "INVALID_PAYLOAD", "Invalid payload");
      return;
    }

    const { sessionId, roomId } = socket.data;
    if (!sessionId || !roomId) return;

    const result = gameManager.respondDraw(sessionId, roomId, parsed.data.accepted);
    if (!result.success) {
      sendError("game:error", result.error ?? "SERVER_ERROR", getErrorMessage(result.error ?? "SERVER_ERROR"));
      return;
    }

    if (!parsed.data.accepted) {
      io.to(roomId).emit("game:draw:declined");
      return;
    }

    if (result.result) {
      const roomState = gameManager.getRoomState(roomId);
      if (!roomState) return;

      io.to(roomId).emit("game:finished", {
        result: result.result,
        chess: roomState.chess,
        clock: roomState.clock,
      });
    }
  });

  // ─── game:rematch ──────────────────────────────────────────────────────────

  socket.on("game:rematch", () => {
    const { sessionId, roomId } = socket.data;
    if (!sessionId || !roomId) return;

    const result = gameManager.requestRematch(sessionId, roomId);
    if (!result.success || !result.rematch) {
      sendError("game:error", result.error ?? "SERVER_ERROR", getErrorMessage(result.error ?? "SERVER_ERROR"));
      return;
    }

    io.to(roomId).emit("game:rematch:state", result.rematch.state);

    if (result.rematch.bothReady && result.newState) {
      io.to(roomId).emit("game:state", result.newState);
    }
  });

  // ─── game:sync ─────────────────────────────────────────────────────────────

  socket.on("game:sync", (payload) => {
    const parsed = GameSyncSchema.safeParse(payload);
    if (!parsed.success) return;

    const { roomId } = socket.data;
    if (!roomId) return;

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState) {
      sendError("game:error", "ROOM_NOT_FOUND", "Room not found");
      return;
    }

    socket.emit("game:sync:response", roomState);
  });

  // ─── room:leave ────────────────────────────────────────────────────────────

  socket.on("room:leave", () => {
    handleDisconnect();
  });

  // ─── Disconnect ────────────────────────────────────────────────────────────

  function handleDisconnect(): void {
    const result = gameManager.handleDisconnect(socket.id);
    if (!result) return;

    const { roomId, player } = result;
    rateLimiter.removeSocket(socket.id);

    socket.to(roomId).emit("player:disconnected", {
      playerId: player.playerId,
      color: player.color,
      connected: false,
      displayName: player.displayName,
    });
  }

  socket.on("disconnect", () => {
    handleDisconnect();
  });
}

function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND: "Game room not found.",
    ROOM_FULL: "This room already has two players.",
    NOT_YOUR_TURN: "It's not your turn.",
    INVALID_MOVE: "That move is not legal.",
    GAME_FINISHED: "This game has already ended.",
    UNAUTHORIZED: "You are not authorized to do that.",
    RATE_LIMITED: "You're sending too many requests.",
    SESSION_INVALID: "Your session is invalid or expired.",
    INVALID_PAYLOAD: "Invalid data sent to server.",
    DRAW_NO_OFFER: "There is no active draw offer.",
    ALREADY_OFFERED_DRAW: "You have already offered a draw.",
    GAME_NOT_STARTED: "The game has not started yet.",
    INVALID_STATE_TRANSITION: "Invalid game state transition.",
    SERVER_ERROR: "An unexpected server error occurred.",
  };
  return messages[code] ?? "An error occurred.";
}
