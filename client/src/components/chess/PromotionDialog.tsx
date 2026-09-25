import type { PlayerColor } from "../../types/game";

interface PromotionDialogProps {
  color: PlayerColor;
  onSelect: (piece: string) => void;
  onCancel: () => void;
}

const PIECES = [
  { piece: "q", label: "Queen", unicode: { w: "♕", b: "♛" } },
  { piece: "r", label: "Rook", unicode: { w: "♖", b: "♜" } },
  { piece: "b", label: "Bishop", unicode: { w: "♗", b: "♝" } },
  { piece: "n", label: "Knight", unicode: { w: "♘", b: "♞" } },
];

export default function PromotionDialog({ color, onSelect, onCancel }: PromotionDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-panel border border-border rounded-xl p-6 shadow-2xl">
        <h3 className="text-text-primary font-medium text-center mb-4">Choose Promotion</h3>
        <div className="flex gap-3">
          {PIECES.map(({ piece, label, unicode }) => (
            <button
              key={piece}
              onClick={() => onSelect(piece)}
              className="flex flex-col items-center gap-2 p-4 bg-bg hover:bg-border rounded-lg border border-border transition-colors group"
            >
              <span
                className={`text-5xl ${color === "w" ? "text-white" : "text-gray-900"}`}
                style={{
                  textShadow:
                    color === "w"
                      ? "0 0 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.8)"
                      : "0 0 3px rgba(255,255,255,0.2)",
                }}
              >
                {unicode[color]}
              </span>
              <span className="text-text-secondary text-xs group-hover:text-text-primary transition-colors">
                {label}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-4 w-full text-text-secondary hover:text-text-primary text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
