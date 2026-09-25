import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChessGame } from "../src/game/ChessGame.js";
import { GameManager } from "../src/game/GameManager.js";

// ─── ChessGame Tests ─────────────────────────────────────────────────────────

describe("ChessGame", () => {
  let game: ChessGame;

  beforeEach(() => {
    game = new ChessGame();
  });

  it("starts with white to move", () => {
    expect(game.getTurn()).toBe("w");
  });

  it("accepts a valid move", () => {
    const result = game.makeMove("e2", "e4");
    expect(result.success).toBe(true);
    expect(result.san).toBe("e4");
    expect(game.getTurn()).toBe("b");
  });

  it("rejects an invalid move", () => {
    const result = game.makeMove("e2", "e5"); // Can't jump two squares from e2 to e5
    expect(result.success).toBe(false);
  });

  it("rejects moving to same square", () => {
    const result = game.makeMove("e2", "e2");
    expect(result.success).toBe(false);
  });

  it("increments sequence on valid move", () => {
    expect(game.getSequence()).toBe(0);
    game.makeMove("e2", "e4");
    expect(game.getSequence()).toBe(1);
    game.makeMove("e7", "e5");
    expect(game.getSequence()).toBe(2);
  });

  it("tracks move history", () => {
    game.makeMove("e2", "e4");
    game.makeMove("e7", "e5");
    expect(game.getMoveHistory()).toEqual(["e4", "e5"]);
  });

  it("detects check", () => {
    // Scholar's mate setup
    game.makeMove("e2", "e4");
    game.makeMove("e7", "e5");
    game.makeMove("d1", "h5");
    game.makeMove("b8", "c6");
    game.makeMove("f1", "c4");
    game.makeMove("g8", "f6");
    // Qxf7# - checkmate
    const result = game.makeMove("h5", "f7");
    expect(result.success).toBe(true);
    expect(game.isCheckmate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it("handles pawn promotion", () => {
    // Set up a position where white can promote
    // Use FEN for a promotion-ready position
    const promoGame = new ChessGame("8/P7/8/8/8/8/8/K6k w - - 0 1");
    const result = promoGame.makeMove("a7", "a8", "q");
    expect(result.success).toBe(true);
    expect(result.san).toContain("Q");
  });

  it("handles castling kingside", () => {
    // Clear pieces between king and rook
    const castleGame = new ChessGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const result = castleGame.makeMove("e1", "g1");
    expect(result.success).toBe(true);
    expect(result.san).toBe("O-O");
  });

  it("handles en passant", () => {
    game.makeMove("e2", "e4");
    game.makeMove("a7", "a5");
    game.makeMove("e4", "e5");
    game.makeMove("d7", "d5"); // d5 is now en passant target
    const result = game.makeMove("e5", "d6"); // en passant
    expect(result.success).toBe(true);
    expect(result.san).toContain("x");
  });

  it("detects stalemate", () => {
    // Stalemate position
    const stalemateGame = new ChessGame("7k/8/6Q1/8/8/8/8/K7 b - - 0 1");
    // Black is already in stalemate (no legal moves but not in check)
    expect(stalemateGame.isStalemate()).toBe(true);
    expect(stalemateGame.isGameOver()).toBe(true);
  });

  it("rejects moves after game over", () => {
    // Checkmate position - White already won
    const mateGame = new ChessGame("r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4");
    expect(mateGame.isGameOver()).toBe(true);
    const result = mateGame.makeMove("e8", "d8");
    expect(result.success).toBe(false);
  });
});

// ─── GameManager Tests ────────────────────────────────────────────────────────

describe("GameManager - Rooms", () => {
  let gm: GameManager;

  beforeEach(() => {
    gm = new GameManager(vi.fn(), vi.fn());
  });

  it("creates a room with a valid 6-char code", () => {
    const { roomId } = gm.createRoom("socket-1", "Alice");
    expect(roomId).toHaveLength(6);
    expect(roomId).toMatch(/^[A-Z0-9]+$/);
  });

  it("returns a session ID on room creation", () => {
    const { sessionId } = gm.createRoom("socket-1", "Alice");
    expect(sessionId).toBeTruthy();
  });

  it("assigns white to creator", () => {
    const { color } = gm.createRoom("socket-1", "Alice");
    expect(color).toBe("w");
  });

  it("allows a second player to join", () => {
    const { roomId } = gm.createRoom("socket-1", "Alice");
    const result = gm.joinRoom("socket-2", roomId, "Bob");
    expect(result.success).toBe(true);
    expect(result.color).toBe("b");
  });

  it("rejects a third player", () => {
    const { roomId } = gm.createRoom("socket-1", "Alice");
    gm.joinRoom("socket-2", roomId, "Bob");
    const result = gm.joinRoom("socket-3", roomId, "Charlie");
    expect(result.success).toBe(false);
    expect(result.error).toBe("ROOM_FULL");
  });

  it("rejects joining a non-existent room", () => {
    const result = gm.joinRoom("socket-1", "XXXXXX", "Alice");
    expect(result.success).toBe(false);
    expect(result.error).toBe("ROOM_NOT_FOUND");
  });

  it("room status becomes READY after second player joins", () => {
    const { roomId } = gm.createRoom("socket-1", "Alice");
    gm.joinRoom("socket-2", roomId, "Bob");
    const state = gm.getRoomState(roomId);
    expect(state?.status).toBe("READY");
  });
});

describe("GameManager - Moves", () => {
  let gm: GameManager;
  let roomId: string;
  let whiteSession: string;
  let blackSession: string;

  beforeEach(async () => {
    gm = new GameManager(vi.fn(), vi.fn());
    const created = gm.createRoom("socket-w", "Alice");
    roomId = created.roomId;
    whiteSession = created.sessionId;
    const joined = gm.joinRoom("socket-b", roomId, "Bob");
    blackSession = joined.sessionId!;
  });

  it("allows white to move first", async () => {
    const result = await gm.makeMove(whiteSession, roomId, "e2", "e4");
    expect(result.success).toBe(true);
  });

  it("rejects black moving first", async () => {
    const result = await gm.makeMove(blackSession, roomId, "e7", "e5");
    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_YOUR_TURN");
  });

  it("rejects white moving twice", async () => {
    await gm.makeMove(whiteSession, roomId, "e2", "e4");
    const result = await gm.makeMove(whiteSession, roomId, "d2", "d4");
    expect(result.success).toBe(false);
    expect(result.error).toBe("NOT_YOUR_TURN");
  });

  it("rejects moves from unknown session", async () => {
    const result = await gm.makeMove("fake-session", roomId, "e2", "e4");
    expect(result.success).toBe(false);
    expect(result.error).toBe("UNAUTHORIZED");
  });

  it("rejects moves to wrong room", async () => {
    const other = gm.createRoom("socket-x", "Eve");
    const result = await gm.makeMove(whiteSession, other.roomId, "e2", "e4");
    expect(result.success).toBe(false);
  });

  it("rejects illegal chess move", async () => {
    const result = await gm.makeMove(whiteSession, roomId, "e2", "e5");
    expect(result.success).toBe(false);
    expect(result.error).toBe("INVALID_MOVE");
  });

  it("rejects moves after game is finished", async () => {
    gm.resign(whiteSession, roomId);
    const result = await gm.makeMove(blackSession, roomId, "e7", "e5");
    expect(result.success).toBe(false);
  });
});

describe("GameManager - Security", () => {
  let gm: GameManager;

  beforeEach(() => {
    gm = new GameManager(vi.fn(), vi.fn());
  });

  it("cannot move opponent's pieces", async () => {
    const { roomId, sessionId: whiteSession } = gm.createRoom("socket-w", "Alice");
    const { sessionId: blackSession } = gm.joinRoom("socket-b", roomId, "Bob");
    // White tries to move black's piece
    const result = await gm.makeMove(whiteSession!, roomId, "e7", "e5");
    expect(result.success).toBe(false);
  });

  it("validates room membership for WebRTC signaling", () => {
    const { roomId } = gm.createRoom("socket-w", "Alice");
    gm.joinRoom("socket-b", roomId, "Bob");
    // socket-x is not in the room
    expect(gm.validateRoomMembership("socket-x", roomId)).toBe(false);
    expect(gm.validateRoomMembership("socket-w", roomId)).toBe(true);
  });

  it("cannot get opponent socket from outside room", () => {
    const { roomId } = gm.createRoom("socket-w", "Alice");
    gm.joinRoom("socket-b", roomId, "Bob");
    expect(gm.getOpponentSocket(roomId, "socket-x")).toBeNull();
  });
});

describe("GameManager - Resign & Draw", () => {
  let gm: GameManager;
  let roomId: string;
  let whiteSession: string;
  let blackSession: string;

  beforeEach(async () => {
    gm = new GameManager(vi.fn(), vi.fn());
    const created = gm.createRoom("socket-w", "Alice");
    roomId = created.roomId;
    whiteSession = created.sessionId;
    const joined = gm.joinRoom("socket-b", roomId, "Bob");
    blackSession = joined.sessionId!;
    // Make a move to get game into PLAYING state
    await gm.makeMove(whiteSession, roomId, "e2", "e4");
  });

  it("white can resign", () => {
    const result = gm.resign(whiteSession, roomId);
    expect(result.success).toBe(true);
    expect(result.result?.winner).toBe("b");
    expect(result.result?.reason).toBe("RESIGNATION");
  });

  it("black can resign", () => {
    const result = gm.resign(blackSession!, roomId);
    expect(result.success).toBe(true);
    expect(result.result?.winner).toBe("w");
  });

  it("cannot resign from wrong room", () => {
    const result = gm.resign(whiteSession, "XXXXXX");
    expect(result.success).toBe(false);
  });

  it("white can offer draw", () => {
    const result = gm.offerDraw(whiteSession, roomId);
    expect(result.success).toBe(true);
    const state = gm.getRoomState(roomId);
    expect(state?.drawOffer?.offeredBy).toBe("w");
  });

  it("black can accept draw", () => {
    gm.offerDraw(whiteSession, roomId);
    const result = gm.respondDraw(blackSession!, roomId, true);
    expect(result.success).toBe(true);
    expect(result.result?.reason).toBe("DRAW_AGREEMENT");
  });

  it("black can decline draw", () => {
    gm.offerDraw(whiteSession, roomId);
    const result = gm.respondDraw(blackSession!, roomId, false);
    expect(result.success).toBe(true);
    expect(result.result).toBeUndefined();
    const state = gm.getRoomState(roomId);
    expect(state?.drawOffer).toBeNull();
  });

  it("cannot respond to draw without offer", () => {
    const result = gm.respondDraw(blackSession!, roomId, true);
    expect(result.success).toBe(false);
    expect(result.error).toBe("DRAW_NO_OFFER");
  });
});

describe("GameManager - Rematch", () => {
  let gm: GameManager;
  let roomId: string;
  let whiteSession: string;
  let blackSession: string;

  beforeEach(async () => {
    gm = new GameManager(vi.fn(), vi.fn());
    const created = gm.createRoom("socket-w", "Alice");
    roomId = created.roomId;
    whiteSession = created.sessionId;
    const joined = gm.joinRoom("socket-b", roomId, "Bob");
    blackSession = joined.sessionId!;
    await gm.makeMove(whiteSession, roomId, "e2", "e4");
    gm.resign(whiteSession, roomId);
  });

  it("one player requesting rematch shows pending state", () => {
    const result = gm.requestRematch(whiteSession, roomId);
    expect(result.success).toBe(true);
    expect(result.rematch?.state.white).toBe(true);
    expect(result.rematch?.bothReady).toBe(false);
  });

  it("both players requesting rematch starts new game", () => {
    gm.requestRematch(whiteSession, roomId);
    const result = gm.requestRematch(blackSession!, roomId);
    expect(result.rematch?.bothReady).toBe(true);
    const state = gm.getRoomState(roomId);
    expect(state?.status).toBe("READY");
    // Colors should be swapped
    expect(state?.players.white?.displayName).toBe("Bob");
    expect(state?.players.black?.displayName).toBe("Alice");
  });

  it("cannot rematch when game not finished", async () => {
    const created2 = gm.createRoom("socket-w2", "C");
    const roomId2 = created2.roomId;
    const ws2 = created2.sessionId;
    gm.joinRoom("socket-b2", roomId2, "D");
    await gm.makeMove(ws2, roomId2, "e2", "e4");
    const result = gm.requestRematch(ws2, roomId2);
    expect(result.success).toBe(false);
  });
});
