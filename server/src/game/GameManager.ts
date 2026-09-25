import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { ChessGame } from "./ChessGame.js";
import { GameClock } from "./GameClock.js";
import type {
  GameRoom,
  PlayerSession,
  PlayerColor,
  RoomStatus,
  GameResult,
  GameResultReason,
  RoomStatePayload,
  PublicPlayerInfo,
  TimeControl,
} from "../types/game.js";
import { DEFAULT_TIME_CONTROL } from "../types/game.js";

const RECONNECT_GRACE_MS = parseInt(process.env.RECONNECT_GRACE_SECONDS ?? "30") * 1000;
const ROOM_EXPIRY_MS = parseInt(process.env.ROOM_EXPIRY_MINUTES ?? "60") * 60 * 1000;

type TimeoutHandler = (roomId: string, loserColor: PlayerColor) => void;
type ClockTickHandler = (roomId: string) => void;

interface InternalRoom {
  room: GameRoom;
  game: ChessGame;
  clock: GameClock;
  expiryTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export class GameManager {
  private rooms: Map<string, InternalRoom> = new Map();
  private sessionToRoom: Map<string, string> = new Map();
  private onTimeout: TimeoutHandler;
  private onClockTick: ClockTickHandler;

  constructor(onTimeout: TimeoutHandler, onClockTick: ClockTickHandler) {
    this.onTimeout = onTimeout;
    this.onClockTick = onClockTick;

    // Periodic cleanup
    setInterval(() => this.cleanupExpiredRooms(), 5 * 60 * 1000);
  }

  // ─── Room Creation ────────────────────────────────────────────────────────

  createRoom(
    socketId: string,
    displayName: string,
    timeControl: TimeControl = DEFAULT_TIME_CONTROL
  ): { roomId: string; sessionId: string; color: PlayerColor } {
    const roomId = this.generateRoomCode();
    const sessionId = uuidv4();
    const playerId = uuidv4();
    const color: PlayerColor = "w";

    const player: PlayerSession = {
      sessionId,
      socketId,
      playerId,
      displayName,
      color,
      connected: true,
      disconnectedAt: null,
    };

    const game = new ChessGame();
    const clock = new GameClock(
      timeControl.initialTimeMs,
      timeControl.incrementMs,
      (loserColor) => this.onTimeout(roomId, loserColor)
    );

    const room: GameRoom = {
      id: roomId,
      status: "WAITING",
      players: { white: player, black: null },
      chess: game.getState(),
      clock: clock.getState(),
      result: null,
      drawOffer: null,
      rematch: { white: false, black: false },
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      clockInterval: null,
      operationLock: false,
    };

    const expiryTimer = setTimeout(() => this.expireRoom(roomId), ROOM_EXPIRY_MS);

    this.rooms.set(roomId, {
      room,
      game,
      clock,
      expiryTimer,
      reconnectTimers: new Map(),
    });
    this.sessionToRoom.set(sessionId, roomId);

    return { roomId, sessionId, color };
  }

  // ─── Join Room ────────────────────────────────────────────────────────────

  joinRoom(
    socketId: string,
    roomId: string,
    displayName: string,
    sessionId?: string
  ): {
    success: boolean;
    error?: string;
    sessionId?: string;
    color?: PlayerColor;
    isReconnection?: boolean;
  } {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };

    const { room } = internal;

    // Reconnection attempt
    if (sessionId) {
      const result = this.handleReconnection(socketId, roomId, sessionId, internal);
      if (result.success) return result;
    }

    // Validate room can accept new player
    if (room.status === "FINISHED" || room.status === "EXPIRED") {
      return { success: false, error: "GAME_FINISHED" };
    }

    if (room.players.black !== null) {
      return { success: false, error: "ROOM_FULL" };
    }

    const newSessionId = uuidv4();
    const playerId = uuidv4();
    const color: PlayerColor = "b";

    const player: PlayerSession = {
      sessionId: newSessionId,
      socketId,
      playerId,
      displayName,
      color,
      connected: true,
      disconnectedAt: null,
    };

    room.players.black = player;
    room.status = "READY";
    room.lastActivityAt = Date.now();

    this.sessionToRoom.set(newSessionId, roomId);

    return { success: true, sessionId: newSessionId, color, isReconnection: false };
  }

  private handleReconnection(
    socketId: string,
    roomId: string,
    sessionId: string,
    internal: InternalRoom
  ): { success: boolean; sessionId?: string; color?: PlayerColor; isReconnection?: boolean; error?: string } {
    const { room } = internal;

    const player =
      room.players.white?.sessionId === sessionId ? room.players.white :
      room.players.black?.sessionId === sessionId ? room.players.black :
      null;

    if (!player) return { success: false, error: "SESSION_INVALID" };

    // Cancel disconnect timer
    const timer = internal.reconnectTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      internal.reconnectTimers.delete(sessionId);
    }

    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    room.lastActivityAt = Date.now();

    return {
      success: true,
      sessionId,
      color: player.color,
      isReconnection: true,
    };
  }

  // ─── Player Disconnect ────────────────────────────────────────────────────

  handleDisconnect(socketId: string): {
    roomId: string;
    player: PlayerSession;
  } | null {
    for (const [roomId, internal] of this.rooms) {
      const { room } = internal;
      const player =
        room.players.white?.socketId === socketId ? room.players.white :
        room.players.black?.socketId === socketId ? room.players.black :
        null;

      if (!player) continue;

      player.connected = false;
      player.disconnectedAt = Date.now();
      room.lastActivityAt = Date.now();

      // Set reconnection grace period timer
      const timer = setTimeout(() => {
        // Grace period expired — mark permanently disconnected
        // Don't auto-end the game, just mark disconnected
        internal.reconnectTimers.delete(player.sessionId);
      }, RECONNECT_GRACE_MS);

      internal.reconnectTimers.set(player.sessionId, timer);

      return { roomId, player };
    }

    return null;
  }

  // ─── Make Move (with lock to prevent race conditions) ─────────────────────

  async makeMove(
    sessionId: string,
    roomId: string,
    from: string,
    to: string,
    promotion?: string,
    expectedSequence?: number
  ): Promise<{
    success: boolean;
    error?: string;
    san?: string;
    newChessState?: ReturnType<ChessGame["getState"]>;
    clockState?: ReturnType<GameClock["getState"]>;
    gameResult?: GameResult;
  }> {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };

    const { room, game, clock } = internal;

    // Serialize operations
    if (room.operationLock) {
      return { success: false, error: "SERVER_ERROR" };
    }
    room.operationLock = true;

    try {
      // Validate state
      if (room.status === "FINISHED" || room.status === "EXPIRED" || room.status === "WAITING") {
        return { success: false, error: room.status === "FINISHED" ? "GAME_FINISHED" : "GAME_NOT_STARTED" };
      }

      // Validate player
      const player = this.getPlayerBySession(room, sessionId);
      if (!player) return { success: false, error: "UNAUTHORIZED" };
      if (!player.connected) return { success: false, error: "UNAUTHORIZED" };

      // Validate turn
      const currentTurn = game.getTurn();
      if (player.color !== currentTurn) {
        return { success: false, error: "NOT_YOUR_TURN" };
      }

      // Validate sequence
      if (expectedSequence !== undefined && expectedSequence !== game.getSequence()) {
        return { success: false, error: "INVALID_MOVE" };
      }

      // Start clock on first move
      if (room.status === "READY") {
        room.status = "PLAYING";
        clock.start(currentTurn);
      }

      // Make the move
      const result = game.makeMove(from, to, promotion);
      if (!result.success || !result.newState) {
        return { success: false, error: "INVALID_MOVE" };
      }

      // Switch clock
      const nextTurn = game.getTurn();
      if (!game.isGameOver()) {
        clock.switchTurn(nextTurn);
      }

      // Update room state
      room.chess = result.newState;
      room.clock = clock.getState();
      room.lastActivityAt = Date.now();
      room.drawOffer = null; // Cancel any pending draw offer on move

      // Check for game over
      let gameResult: GameResult | undefined;
      if (game.isGameOver()) {
        let reason: GameResultReason;
        let winner: PlayerColor | null = null;

        if (game.isCheckmate()) {
          reason = "CHECKMATE";
          // The player who just moved won (current turn has no moves = loser)
          winner = currentTurn;
        } else if (game.isStalemate()) {
          reason = "STALEMATE";
        } else if (game.isDraw()) {
          // Determine specific draw type
          reason = "DRAW_AGREEMENT"; // Default, chess.js handles the specifics
        } else {
          reason = "DRAW_AGREEMENT";
        }

        gameResult = { winner, reason, finalFen: game.getFen() };
        room.result = gameResult;
        room.status = "FINISHED";
        clock.stop();
      }

      return {
        success: true,
        san: result.san,
        newChessState: result.newState,
        clockState: clock.getState(),
        gameResult,
      };
    } finally {
      room.operationLock = false;
    }
  }

  // ─── Resign ───────────────────────────────────────────────────────────────

  resign(sessionId: string, roomId: string): { success: boolean; error?: string; result?: GameResult } {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };
    const { room, clock } = internal;

    if (room.status !== "PLAYING" && room.status !== "READY") {
      return { success: false, error: "GAME_NOT_STARTED" };
    }

    const player = this.getPlayerBySession(room, sessionId);
    if (!player) return { success: false, error: "UNAUTHORIZED" };

    const winner: PlayerColor = player.color === "w" ? "b" : "w";
    const result: GameResult = {
      winner,
      reason: "RESIGNATION",
      finalFen: room.chess.fen,
    };

    room.result = result;
    room.status = "FINISHED";
    clock.stop();

    return { success: true, result };
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  offerDraw(sessionId: string, roomId: string): { success: boolean; error?: string } {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };
    const { room } = internal;

    if (room.status !== "PLAYING") return { success: false, error: "GAME_NOT_STARTED" };

    const player = this.getPlayerBySession(room, sessionId);
    if (!player) return { success: false, error: "UNAUTHORIZED" };

    if (room.drawOffer?.offeredBy === player.color) {
      return { success: false, error: "ALREADY_OFFERED_DRAW" };
    }

    room.drawOffer = { offeredBy: player.color, offeredAt: Date.now() };
    return { success: true };
  }

  respondDraw(
    sessionId: string,
    roomId: string,
    accepted: boolean
  ): { success: boolean; error?: string; result?: GameResult } {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };
    const { room, clock } = internal;

    if (!room.drawOffer) return { success: false, error: "DRAW_NO_OFFER" };

    const player = this.getPlayerBySession(room, sessionId);
    if (!player) return { success: false, error: "UNAUTHORIZED" };

    // Must be the other player responding
    if (room.drawOffer.offeredBy === player.color) {
      return { success: false, error: "UNAUTHORIZED" };
    }

    room.drawOffer = null;

    if (!accepted) {
      return { success: true };
    }

    const result: GameResult = {
      winner: null,
      reason: "DRAW_AGREEMENT",
      finalFen: room.chess.fen,
    };
    room.result = result;
    room.status = "FINISHED";
    clock.stop();

    return { success: true, result };
  }

  // ─── Rematch ──────────────────────────────────────────────────────────────

  requestRematch(sessionId: string, roomId: string): {
    success: boolean;
    error?: string;
    rematch?: { state: GameRoom["rematch"]; bothReady: boolean };
    newState?: ReturnType<GameManager["getRoomState"]>;
  } {
    const internal = this.rooms.get(roomId);
    if (!internal) return { success: false, error: "ROOM_NOT_FOUND" };
    const { room } = internal;

    if (room.status !== "FINISHED") return { success: false, error: "GAME_NOT_STARTED" };

    const player = this.getPlayerBySession(room, sessionId);
    if (!player) return { success: false, error: "UNAUTHORIZED" };

    if (player.color === "w") room.rematch.white = true;
    else room.rematch.black = true;

    const bothReady = room.rematch.white && room.rematch.black;

    if (bothReady) {
      this.startRematch(roomId, internal);
    }

    return {
      success: true,
      rematch: { state: room.rematch, bothReady },
      newState: bothReady ? this.getRoomState(roomId) : undefined,
    };
  }

  private startRematch(roomId: string, internal: InternalRoom): void {
    const { room } = internal;

    // Swap colors
    const white = room.players.white;
    const black = room.players.black;

    if (white) {
      white.color = "b";
      room.players.black = white;
    }
    if (black) {
      black.color = "w";
      room.players.white = black;
    }

    // Reset game
    const newGame = new ChessGame();
    internal.game = newGame;

    // Reset clock
    const oldClock = internal.clock;
    const clockState = oldClock.getState();
    oldClock.destroy();

    const newClock = new GameClock(
      clockState.whiteRemainingMs + clockState.blackRemainingMs > 0
        ? 10 * 60 * 1000 // Reset to default
        : 10 * 60 * 1000,
      clockState.incrementMs,
      (loserColor) => this.onTimeout(roomId, loserColor)
    );
    internal.clock = newClock;

    // Reset room state
    room.status = "READY";
    room.chess = newGame.getState();
    room.clock = newClock.getState();
    room.result = null;
    room.drawOffer = null;
    room.rematch = { white: false, black: false };
    room.lastActivityAt = Date.now();
  }

  // ─── Timeout (called by clock) ────────────────────────────────────────────

  handleTimeout(roomId: string, loserColor: PlayerColor): GameResult | null {
    const internal = this.rooms.get(roomId);
    if (!internal) return null;
    const { room } = internal;

    if (room.status !== "PLAYING") return null;

    const result: GameResult = {
      winner: loserColor === "w" ? "b" : "w",
      reason: "TIMEOUT",
      finalFen: room.chess.fen,
    };

    room.result = result;
    room.status = "FINISHED";

    return result;
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  getRoomState(roomId: string): RoomStatePayload | null {
    const internal = this.rooms.get(roomId);
    if (!internal) return null;
    const { room, clock } = internal;

    // Always get fresh clock state
    room.clock = clock.getState();

    return {
      id: room.id,
      status: room.status,
      players: {
        white: room.players.white ? this.toPublicPlayer(room.players.white) : null,
        black: room.players.black ? this.toPublicPlayer(room.players.black) : null,
      },
      chess: room.chess,
      clock: room.clock,
      result: room.result,
      drawOffer: room.drawOffer,
      rematch: room.rematch,
    };
  }

  getClockState(roomId: string) {
    const internal = this.rooms.get(roomId);
    if (!internal) return null;
    return internal.clock.getState();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getPlayerBySession(room: GameRoom, sessionId: string): PlayerSession | null {
    if (room.players.white?.sessionId === sessionId) return room.players.white;
    if (room.players.black?.sessionId === sessionId) return room.players.black;
    return null;
  }

  getPlayerBySocket(socketId: string): { room: GameRoom; player: PlayerSession } | null {
    for (const { room } of this.rooms.values()) {
      if (room.players.white?.socketId === socketId) {
        return { room, player: room.players.white };
      }
      if (room.players.black?.socketId === socketId) {
        return { room, player: room.players.black };
      }
    }
    return null;
  }

  getRoomIdBySession(sessionId: string): string | undefined {
    return this.sessionToRoom.get(sessionId);
  }

  getOpponentSocket(roomId: string, mySocketId: string): string | null {
    const internal = this.rooms.get(roomId);
    if (!internal) return null;
    const { room } = internal;

    if (room.players.white?.socketId === mySocketId) {
      return room.players.black?.socketId ?? null;
    }
    if (room.players.black?.socketId === mySocketId) {
      return room.players.white?.socketId ?? null;
    }
    return null;
  }

  validateRoomMembership(socketId: string, roomId: string): boolean {
    const internal = this.rooms.get(roomId);
    if (!internal) return false;
    const { room } = internal;
    return (
      room.players.white?.socketId === socketId ||
      room.players.black?.socketId === socketId
    );
  }

  private toPublicPlayer(player: PlayerSession): PublicPlayerInfo {
    return {
      playerId: player.playerId,
      displayName: player.displayName,
      color: player.color,
      connected: player.connected,
    };
  }

  private generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code: string;
    do {
      code = Array.from(randomBytes(6))
        .map((b) => chars[b % chars.length])
        .join("");
    } while (this.rooms.has(code));
    return code;
  }

  private expireRoom(roomId: string): void {
    const internal = this.rooms.get(roomId);
    if (!internal) return;
    const { room, clock } = internal;

    if (room.status !== "FINISHED") {
      room.status = "EXPIRED";
      clock.destroy();
    }

    // Clean up after additional delay
    setTimeout(() => {
      this.rooms.delete(roomId);
      // Clean session mappings
      if (room.players.white) this.sessionToRoom.delete(room.players.white.sessionId);
      if (room.players.black) this.sessionToRoom.delete(room.players.black.sessionId);
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [roomId, internal] of this.rooms) {
      const { room } = internal;
      if (
        room.status === "EXPIRED" ||
        (room.status === "FINISHED" && now - room.lastActivityAt > ROOM_EXPIRY_MS) ||
        (room.status === "WAITING" && now - room.createdAt > 30 * 60 * 1000)
      ) {
        internal.clock.destroy();
        if (room.players.white) this.sessionToRoom.delete(room.players.white.sessionId);
        if (room.players.black) this.sessionToRoom.delete(room.players.black.sessionId);
        this.rooms.delete(roomId);
      }
    }
  }
}
