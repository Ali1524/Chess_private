import type { GameResult, PlayerColor, RematchState } from "../../types/game";

interface GameResultOverlayProps {
  result: GameResult;
  myColor: PlayerColor;
  rematch: RematchState;
  onRematch: () => void;
  onLeave: () => void;
}

const REASON_LABELS: Record<string, string> = {
  CHECKMATE: "Checkmate",
  STALEMATE: "Stalemate",
  DRAW_AGREEMENT: "Draw by Agreement",
  RESIGNATION: "Resignation",
  TIMEOUT: "Timeout",
  THREEFOLD_REPETITION: "Threefold Repetition",
  INSUFFICIENT_MATERIAL: "Insufficient Material",
  FIFTY_MOVE_RULE: "50-Move Rule",
};

export default function GameResultOverlay({
  result,
  myColor,
  rematch,
  onRematch,
  onLeave,
}: GameResultOverlayProps) {
  const isDraw = result.winner === null;
  const iWon = result.winner === myColor;

  const myRematch = myColor === "w" ? rematch.white : rematch.black;
  const theyRematch = myColor === "w" ? rematch.black : rematch.white;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-40 rounded-lg">
      <div className="text-center px-8 py-10">
        {/* Result icon */}
        <div className={`text-6xl mb-4 ${isDraw ? "text-text-secondary" : iWon ? "text-accent" : "text-text-secondary"}`}>
          {isDraw ? "½" : iWon ? "♔" : "♚"}
        </div>

        {/* Main result */}
        <h2 className={`text-3xl font-semibold mb-2 ${
          isDraw ? "text-text-secondary" : iWon ? "text-accent" : "text-red-400"
        }`}>
          {isDraw ? "Draw" : iWon ? "You Won" : "You Lost"}
        </h2>

        {/* Reason */}
        <p className="text-text-secondary text-sm mb-8">
          {REASON_LABELS[result.reason] ?? result.reason}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onRematch}
            disabled={myRematch}
            className={`px-8 py-3 rounded-lg font-medium transition-colors ${
              myRematch
                ? "bg-panel border border-border text-text-secondary cursor-default"
                : "bg-accent hover:bg-accent-dim text-bg"
            }`}
          >
            {myRematch
              ? theyRematch
                ? "Starting rematch…"
                : "Waiting for opponent…"
              : "Rematch"}
          </button>

          <button
            onClick={onLeave}
            className="px-8 py-3 bg-bg border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            Leave Game
          </button>
        </div>

        {/* Rematch state indicators */}
        {(rematch.white || rematch.black) && (
          <p className="mt-4 text-text-secondary text-xs">
            {rematch.white && !rematch.black && "White wants rematch…"}
            {!rematch.white && rematch.black && "Black wants rematch…"}
            {rematch.white && rematch.black && "Both ready!"}
          </p>
        )}
      </div>
    </div>
  );
}
