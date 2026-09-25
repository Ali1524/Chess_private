import { useState, useEffect, useRef } from "react";
import type { ClockState, PlayerColor } from "../types/game";

export interface DisplayClock {
  whiteMs: number;
  blackMs: number;
  activeColor: PlayerColor | null;
}

export function useGameClock(serverClock: ClockState | null): DisplayClock {
  const [display, setDisplay] = useState<DisplayClock>({
    whiteMs: serverClock?.whiteRemainingMs ?? 10 * 60 * 1000,
    blackMs: serverClock?.blackRemainingMs ?? 10 * 60 * 1000,
    activeColor: serverClock?.activeColor ?? null,
  });

  const clockRef = useRef<{
    whiteMs: number;
    blackMs: number;
    activeColor: PlayerColor | null;
    turnStartedAt: number | null;
    lastSync: number;
  }>({
    whiteMs: serverClock?.whiteRemainingMs ?? 10 * 60 * 1000,
    blackMs: serverClock?.blackRemainingMs ?? 10 * 60 * 1000,
    activeColor: serverClock?.activeColor ?? null,
    turnStartedAt: serverClock?.turnStartedAt ?? null,
    lastSync: Date.now(),
  });

  // Sync from server state
  useEffect(() => {
    if (!serverClock) return;
    clockRef.current = {
      whiteMs: serverClock.whiteRemainingMs,
      blackMs: serverClock.blackRemainingMs,
      activeColor: serverClock.activeColor,
      turnStartedAt: serverClock.turnStartedAt,
      lastSync: Date.now(),
    };
    setDisplay({
      whiteMs: serverClock.whiteRemainingMs,
      blackMs: serverClock.blackRemainingMs,
      activeColor: serverClock.activeColor,
    });
  }, [serverClock]);

  // Client-side visual countdown (display only, not authoritative)
  useEffect(() => {
    const interval = setInterval(() => {
      const c = clockRef.current;
      if (!c.activeColor || !c.turnStartedAt) return;

      const elapsed = Date.now() - c.turnStartedAt;

      setDisplay({
        whiteMs: c.activeColor === "w" ? Math.max(0, c.whiteMs - elapsed) : c.whiteMs,
        blackMs: c.activeColor === "b" ? Math.max(0, c.blackMs - elapsed) : c.blackMs,
        activeColor: c.activeColor,
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return display;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
