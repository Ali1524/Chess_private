import type { PublicPlayerInfo, PlayerColor } from "../../types/game";
import { formatTime } from "../../hooks/useGameClock";

interface PlayerClockProps {
  player: PublicPlayerInfo | null;
  timeMs: number;
  isActive: boolean;
  isMe: boolean;
  color: PlayerColor;
}

export default function PlayerClock({ player, timeMs, isActive, isMe, color }: PlayerClockProps) {
  const isLow = timeMs < 30_000; // Under 30 seconds

  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all duration-300 ${
      isActive
        ? "bg-panel border-accent"
        : "bg-bg border-border"
    }`}>
      <div className="flex items-center gap-3">
        {/* Color indicator */}
        <div className={`w-4 h-4 rounded-sm border ${
          color === "w"
            ? "bg-white border-gray-300"
            : "bg-gray-900 border-gray-700"
        }`} />

        <div>
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-sm font-medium">
              {player?.displayName ?? "Waiting…"}
            </span>
            {isMe && (
              <span className="text-text-secondary text-xs">(You)</span>
            )}
            {player && !player.connected && (
              <span className="text-red-400 text-xs animate-pulse">disconnected</span>
            )}
          </div>
        </div>
      </div>

      {/* Clock */}
      <div className={`font-mono text-xl font-semibold tabular-nums transition-colors ${
        isLow && isActive
          ? "text-red-400 animate-pulse"
          : isActive
          ? "text-accent"
          : "text-text-secondary"
      }`}>
        {formatTime(timeMs)}
      </div>
    </div>
  );
}
