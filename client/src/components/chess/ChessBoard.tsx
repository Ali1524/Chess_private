import { useCallback } from "react";
import type { PlayerColor } from "../../types/game";

interface ChessBoardProps {
  fen: string;
  myColor: PlayerColor;
  turn: PlayerColor;
  selectedSquare: string | null;
  lastMove: { from: string; to: string } | null;
  isCheck: boolean;
  onSquareClick: (square: string, pieceColor: PlayerColor | null) => void;
  disabled?: boolean;
}

interface PieceInfo {
  type: string;
  color: PlayerColor;
}

const PIECE_UNICODE: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function parseFen(fen: string): (PieceInfo | null)[][] {
  const board: (PieceInfo | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const ranks = fen.split(" ")[0].split("/");

  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const char of ranks[r]) {
      const empty = parseInt(char);
      if (!isNaN(empty)) {
        col += empty;
      } else {
        const color: PlayerColor = char === char.toUpperCase() ? "w" : "b";
        board[r][col] = { type: char, color };
        col++;
      }
    }
  }
  return board;
}

function coordsToSquare(row: number, col: number): string {
  return String.fromCharCode("a".charCodeAt(0) + col) + String(8 - row);
}

export default function ChessBoard({
  fen,
  myColor,
  turn,
  selectedSquare,
  lastMove,
  isCheck,
  onSquareClick,
  disabled = false,
}: ChessBoardProps) {
  const board = parseFen(fen);
  const isFlipped = myColor === "b";

  // Find king position for check highlighting
  const kingSquare = useCallback((): string | null => {
    if (!isCheck) return null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === (turn === "w" ? "K" : "k")) {
          return coordsToSquare(r, c);
        }
      }
    }
    return null;
  }, [board, isCheck, turn]);

  const checkedKing = kingSquare();

  const rows = isFlipped ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const cols = isFlipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  return (
    <div className="chess-board-shadow rounded-lg overflow-hidden inline-block">
      {rows.map((row) => (
        <div key={row} className="flex">
          {/* Rank label */}
          <div className="w-6 flex items-center justify-center text-xs text-text-secondary bg-bg select-none">
            {isFlipped ? row + 1 : 8 - row}
          </div>
          {cols.map((col) => {
            const piece = board[row][col];
            const square = coordsToSquare(row, col);
            const isLight = (row + col) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isLastFrom = lastMove?.from === square;
            const isLastTo = lastMove?.to === square;
            const isCheckedKing = checkedKing === square;
            const isMyTurn = turn === myColor && !disabled;

            let bgClass = isLight ? "bg-square-light" : "bg-square-dark";

            if (isCheckedKing) {
              bgClass = "bg-red-500";
            } else if (isSelected) {
              bgClass = "bg-square-selected";
            } else if (isLastFrom || isLastTo) {
              bgClass = isLight ? "bg-yellow-200" : "bg-yellow-600";
            }

            return (
              <div
                key={col}
                className={`
                  w-14 h-14 md:w-16 md:h-16
                  flex items-center justify-center
                  ${bgClass}
                  ${isMyTurn ? "cursor-pointer" : "cursor-default"}
                  relative select-none
                  transition-colors duration-100
                `}
                onClick={() => {
                  if (disabled) return;
                  onSquareClick(square, piece?.color ?? null);
                }}
              >
                {piece && (
                  <span
                    className={`
                      text-3xl md:text-4xl leading-none
                      ${piece.color === "w" ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" : "text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.2)]"}
                      transition-transform duration-100
                      ${isSelected ? "scale-110" : ""}
                    `}
                    style={{ textShadow: piece.color === "w" ? "0 0 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.8)" : "0 0 3px rgba(255,255,255,0.2)" }}
                  >
                    {PIECE_UNICODE[piece.type]}
                  </span>
                )}
                {/* Selected square indicator dot */}
                {isSelected && !piece && (
                  <div className="w-4 h-4 rounded-full bg-black opacity-20" />
                )}
              </div>
            );
          })}
          {/* Extra space for file labels alignment */}
          <div className="w-0" />
        </div>
      ))}
      {/* File labels */}
      <div className="flex bg-bg">
        <div className="w-6" />
        {cols.map((col) => (
          <div
            key={col}
            className="w-14 md:w-16 flex items-center justify-center text-xs text-text-secondary py-1 select-none"
          >
            {String.fromCharCode("a".charCodeAt(0) + col)}
          </div>
        ))}
      </div>
    </div>
  );
}

export { coordsToSquare };
