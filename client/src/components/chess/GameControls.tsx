import { useState } from "react";
import type { DrawOffer, PlayerColor } from "../../types/game";

interface GameControlsProps {
  myColor: PlayerColor;
  drawOffer: DrawOffer | null;
  gameActive: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onRespondDraw: (accepted: boolean) => void;
}

export default function GameControls({
  myColor,
  drawOffer,
  gameActive,
  onResign,
  onOfferDraw,
  onRespondDraw,
}: GameControlsProps) {
  const [resignConfirm, setResignConfirm] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);

  const incomingDraw = drawOffer && drawOffer.offeredBy !== myColor;
  const myDrawPending = drawOffer && drawOffer.offeredBy === myColor;

  const handleResign = () => {
    if (!resignConfirm) {
      setResignConfirm(true);
      setTimeout(() => setResignConfirm(false), 3000);
      return;
    }
    onResign();
    setResignConfirm(false);
  };

  const handleOfferDraw = () => {
    if (!drawOffered) {
      onOfferDraw();
      setDrawOffered(true);
      setTimeout(() => setDrawOffered(false), 5000);
    }
  };

  if (!gameActive) return null;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Incoming draw offer */}
      {incomingDraw && (
        <div className="bg-panel border border-accent rounded-lg p-3 flex items-center justify-between gap-2">
          <span className="text-text-secondary text-sm">Draw offered</span>
          <div className="flex gap-2">
            <button
              onClick={() => onRespondDraw(true)}
              className="px-3 py-1.5 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-dim transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => onRespondDraw(false)}
              className="px-3 py-1.5 bg-bg border border-border text-text-primary text-sm rounded-lg hover:bg-border transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* Resign */}
        <button
          onClick={handleResign}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            resignConfirm
              ? "bg-red-600 hover:bg-red-700 text-white border border-red-500"
              : "bg-bg border border-border text-text-secondary hover:text-text-primary hover:border-red-800 transition-colors"
          }`}
        >
          {resignConfirm ? "Confirm Resign?" : "Resign"}
        </button>

        {/* Offer Draw */}
        <button
          onClick={handleOfferDraw}
          disabled={!!drawOffer}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            myDrawPending
              ? "bg-bg border border-accent text-accent cursor-default"
              : "bg-bg border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {myDrawPending ? "Draw Offered…" : "Offer Draw"}
        </button>
      </div>
    </div>
  );
}
