import { Chess } from "chess.js";
import type { ChessState, PlayerColor } from "../types/game.js";

export interface MoveResult {
  success: boolean;
  san?: string;
  error?: string;
  newState?: ChessState;
}

export class ChessGame {
  private chess: Chess;
  private moveHistory: string[];
  private sequence: number;

  constructor(fen?: string, history?: string[], sequence?: number) {
    this.chess = new Chess(fen);
    this.moveHistory = history ?? [];
    this.sequence = sequence ?? 0;
  }

  makeMove(
    from: string,
    to: string,
    promotion?: string
  ): MoveResult {
    const moveInput: { from: string; to: string; promotion?: string } = { from, to };
    if (promotion) {
      moveInput.promotion = promotion;
    }

    try {
      const result = this.chess.move(moveInput);
      if (!result) {
        return { success: false, error: "Illegal move" };
      }

      this.moveHistory.push(result.san);
      this.sequence++;

      return {
        success: true,
        san: result.san,
        newState: this.getState(),
      };
    } catch {
      return { success: false, error: "Illegal move" };
    }
  }

  getTurn(): PlayerColor {
    return this.chess.turn() as PlayerColor;
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  isCheck(): boolean {
    return this.chess.inCheck();
  }

  getFen(): string {
    return this.chess.fen();
  }

  getPgn(): string {
    return this.chess.pgn();
  }

  getSequence(): number {
    return this.sequence;
  }

  getMoveHistory(): string[] {
    return [...this.moveHistory];
  }

  getState(): ChessState {
    return {
      fen: this.chess.fen(),
      turn: this.chess.turn() as PlayerColor,
      moveHistory: [...this.moveHistory],
      pgn: this.chess.pgn(),
      sequence: this.sequence,
      isCheck: this.chess.inCheck(),
      isCheckmate: this.chess.isCheckmate(),
      isStalemate: this.chess.isStalemate(),
      isDraw: this.chess.isDraw(),
    };
  }

  // Verify that a move is legal without making it (for preview)
  isLegalMove(from: string, to: string, promotion?: string): boolean {
    const moves = this.chess.moves({ square: from as Parameters<Chess["moves"]>[0]["square"], verbose: true });
    return moves.some(
      (m) =>
        m.from === from &&
        m.to === to &&
        (!promotion || m.promotion === promotion)
    );
  }

  getLegalMoves(square?: string): string[] {
    const opts = square ? { square: square as Parameters<Chess["moves"]>[0]["square"], verbose: false } : { verbose: false };
    return this.chess.moves(opts) as string[];
  }
}
