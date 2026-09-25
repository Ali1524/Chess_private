import { useState, useEffect, useCallback, useRef } from "react";
import type { AppSocket } from "../services/socket";
import type {
  RoomStatePayload,
  ChessState,
  ClockState,
  GameResult,
  DrawOffer,
  RematchState,
  PlayerColor,
} from "../types/game";

export interface GameState {
  room: RoomStatePayload | null;
  chess: ChessState | null;
  clock: ClockState | null;
  result: GameResult | null;
  drawOffer: DrawOffer | null;
  rematch: RematchState;
  myColor: PlayerColor | null;
  selectedSquare: string | null;
  promotionPending: { from: string; to: string } | null;
  lastMove: { from: string; to: string } | null;
  opponentConnected: boolean;
  gameError: string | null;
}

const initialState: GameState = {
  room: null,
  chess: null,
  clock: null,
  result: null,
  drawOffer: null,
  rematch: { white: false, black: false },
  myColor: null,
  selectedSquare: null,
  promotionPending: null,
  lastMove: null,
  opponentConnected: true,
  gameError: null,
};

export function useChessGame(socket: AppSocket, myColor: PlayerColor | null) {
  const [state, setState] = useState<GameState>({ ...initialState, myColor });
  const sequenceRef = useRef(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Sync helper ────────────────────────────────────────────────────────────
  const requestSync = useCallback(() => {
    socket.emit("game:sync", { expectedSequence: sequenceRef.current });
  }, [socket]);

  // ─── Server event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    setState((s) => ({ ...s, myColor }));
  }, [myColor]);

  useEffect(() => {
    const onRoomState = (payload: RoomStatePayload) => {
      sequenceRef.current = payload.chess.sequence;
      setState((s) => ({
        ...s,
        room: payload,
        chess: payload.chess,
        clock: payload.clock,
        result: payload.result,
        drawOffer: payload.drawOffer,
        rematch: payload.rematch,
        gameError: null,
      }));
    };

    const onMoveAccepted = (payload: {
      chess: ChessState;
      clock: ClockState;
      move: { from: string; to: string; san: string; promotion?: string };
    }) => {
      const expected = sequenceRef.current + 1;
      if (payload.chess.sequence !== expected) {
        // Sequence mismatch - request sync
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(requestSync, 100);
        return;
      }
      sequenceRef.current = payload.chess.sequence;

      setState((s) => ({
        ...s,
        chess: payload.chess,
        clock: payload.clock,
        lastMove: { from: payload.move.from, to: payload.move.to },
        selectedSquare: null,
        promotionPending: null,
        gameError: null,
      }));
    };

    const onGameFinished = (payload: {
      result: GameResult;
      chess: ChessState;
      clock: ClockState;
    }) => {
      sequenceRef.current = payload.chess.sequence;
      setState((s) => ({
        ...s,
        chess: payload.chess,
        clock: payload.clock,
        result: payload.result,
        selectedSquare: null,
        promotionPending: null,
      }));
    };

    const onDrawOffered = (payload: DrawOffer) => {
      setState((s) => ({ ...s, drawOffer: payload }));
    };

    const onDrawDeclined = () => {
      setState((s) => ({ ...s, drawOffer: null }));
    };

    const onRematchState = (payload: RematchState) => {
      setState((s) => ({ ...s, rematch: payload }));
    };

    const onSyncResponse = (payload: RoomStatePayload) => {
      sequenceRef.current = payload.chess.sequence;
      setState((s) => ({
        ...s,
        room: payload,
        chess: payload.chess,
        clock: payload.clock,
        result: payload.result,
        drawOffer: payload.drawOffer,
        rematch: payload.rematch,
        gameError: null,
      }));
    };

    const onGameError = (payload: { code: string; message: string }) => {
      setState((s) => ({ ...s, gameError: payload.message }));
      setTimeout(() => setState((s) => ({ ...s, gameError: null })), 4000);
    };

    const onPlayerConnected = (payload: { color: PlayerColor; connected: boolean }) => {
      setState((s) => ({
        ...s,
        opponentConnected: s.myColor !== payload.color ? payload.connected : s.opponentConnected,
      }));
    };

    const onPlayerDisconnected = (payload: { color: PlayerColor; connected: boolean }) => {
      setState((s) => ({
        ...s,
        opponentConnected: s.myColor !== payload.color ? false : s.opponentConnected,
      }));
    };

    socket.on("game:state", onRoomState);
    socket.on("game:move:accepted", onMoveAccepted);
    socket.on("game:finished", onGameFinished);
    socket.on("game:draw:offered", onDrawOffered);
    socket.on("game:draw:declined", onDrawDeclined);
    socket.on("game:rematch:state", onRematchState);
    socket.on("game:sync:response", onSyncResponse);
    socket.on("game:error", onGameError);
    socket.on("player:connected", onPlayerConnected);
    socket.on("player:disconnected", onPlayerDisconnected);

    // The initial room event can arrive before this hook mounts after navigation.
    requestSync();

    return () => {
      socket.off("game:state", onRoomState);
      socket.off("game:move:accepted", onMoveAccepted);
      socket.off("game:finished", onGameFinished);
      socket.off("game:draw:offered", onDrawOffered);
      socket.off("game:draw:declined", onDrawDeclined);
      socket.off("game:rematch:state", onRematchState);
      socket.off("game:sync:response", onSyncResponse);
      socket.off("game:error", onGameError);
      socket.off("player:connected", onPlayerConnected);
      socket.off("player:disconnected", onPlayerDisconnected);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [socket, requestSync]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const selectSquare = useCallback(
    (square: string, pieceColor?: PlayerColor) => {
      setState((s) => {
        if (!s.chess || !s.myColor) return s;
        if (s.result) return s;
        if (s.chess.turn !== s.myColor) return s;

        // If clicking own piece, select it
        if (pieceColor === s.myColor) {
          return { ...s, selectedSquare: square };
        }

        // If a square is already selected, attempt move
        if (s.selectedSquare && s.selectedSquare !== square) {
          return { ...s, selectedSquare: square };
        }

        return { ...s, selectedSquare: square };
      });
    },
    []
  );

  const attemptMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!state.chess) return;
      const seq = sequenceRef.current;

      // Check if this might be a promotion (client-side hint only)
      socket.emit("game:move", { from, to, promotion, expectedSequence: seq });
      setState((s) => ({ ...s, selectedSquare: null, promotionPending: null }));
    },
    [socket, state.chess]
  );

  const initiateMove = useCallback(
    (from: string, to: string) => {
      // Check if pawn promotion is needed (client-side detection for UX)
      const chess = state.chess;
      if (!chess || !state.myColor) return;

      const fen = chess.fen;
      // Simple promotion detection: pawn moving to back rank
      const piece = getPieceAt(fen, from);
      const isPromoting =
        piece?.toLowerCase() === "p" &&
        ((state.myColor === "w" && to[1] === "8") ||
          (state.myColor === "b" && to[1] === "1"));

      if (isPromoting) {
        setState((s) => ({ ...s, promotionPending: { from, to }, selectedSquare: null }));
      } else {
        attemptMove(from, to);
      }
    },
    [state.chess, state.myColor, attemptMove]
  );

  const clearSelection = useCallback(() => {
    setState((s) => ({ ...s, selectedSquare: null, promotionPending: null }));
  }, []);

  const resign = useCallback(() => {
    socket.emit("game:resign", { confirmed: true });
  }, [socket]);

  const offerDraw = useCallback(() => {
    socket.emit("game:draw:offer");
  }, [socket]);

  const respondDraw = useCallback(
    (accepted: boolean) => {
      socket.emit("game:draw:respond", { accepted });
    },
    [socket]
  );

  const requestRematch = useCallback(() => {
    socket.emit("game:rematch");
  }, [socket]);

  return {
    state,
    selectSquare,
    initiateMove,
    attemptMove,
    clearSelection,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
    requestSync,
  };
}

function getPieceAt(fen: string, square: string): string | null {
  const board = fen.split(" ")[0];
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(square[1]);

  let col = 0;
  let row = 0;

  for (const char of board) {
    if (char === "/") {
      row++;
      col = 0;
      continue;
    }
    if (!isNaN(parseInt(char))) {
      col += parseInt(char);
      continue;
    }
    if (row === rank && col === file) {
      return char;
    }
    col++;
  }
  return null;
}

