import type { ClockState, PlayerColor } from "../types/game.js";

export type TimeoutCallback = (color: PlayerColor) => void;

export class GameClock {
  private whiteRemainingMs: number;
  private blackRemainingMs: number;
  private activeColor: PlayerColor | null;
  private turnStartedAt: number | null;
  private incrementMs: number;
  private interval: ReturnType<typeof setInterval> | null;
  private onTimeout: TimeoutCallback;

  constructor(
    initialTimeMs: number,
    incrementMs: number,
    onTimeout: TimeoutCallback
  ) {
    this.whiteRemainingMs = initialTimeMs;
    this.blackRemainingMs = initialTimeMs;
    this.activeColor = null;
    this.turnStartedAt = null;
    this.incrementMs = incrementMs;
    this.interval = null;
    this.onTimeout = onTimeout;
  }

  start(color: PlayerColor): void {
    this.activeColor = color;
    this.turnStartedAt = Date.now();
    this.startInterval();
  }

  switchTurn(newColor: PlayerColor): void {
    if (this.activeColor !== null && this.turnStartedAt !== null) {
      // Apply elapsed time to previous player
      const elapsed = Date.now() - this.turnStartedAt;
      if (this.activeColor === "w") {
        this.whiteRemainingMs = Math.max(0, this.whiteRemainingMs - elapsed + this.incrementMs);
      } else {
        this.blackRemainingMs = Math.max(0, this.blackRemainingMs - elapsed + this.incrementMs);
      }
    }

    this.activeColor = newColor;
    this.turnStartedAt = Date.now();
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Commit remaining elapsed time
    if (this.activeColor !== null && this.turnStartedAt !== null) {
      const elapsed = Date.now() - this.turnStartedAt;
      if (this.activeColor === "w") {
        this.whiteRemainingMs = Math.max(0, this.whiteRemainingMs - elapsed);
      } else {
        this.blackRemainingMs = Math.max(0, this.blackRemainingMs - elapsed);
      }
    }
    this.activeColor = null;
    this.turnStartedAt = null;
  }

  getState(): ClockState {
    return {
      whiteRemainingMs: this.getWhiteRemaining(),
      blackRemainingMs: this.getBlackRemaining(),
      activeColor: this.activeColor,
      turnStartedAt: this.turnStartedAt,
      incrementMs: this.incrementMs,
    };
  }

  private getWhiteRemaining(): number {
    if (this.activeColor === "w" && this.turnStartedAt !== null) {
      return Math.max(0, this.whiteRemainingMs - (Date.now() - this.turnStartedAt));
    }
    return this.whiteRemainingMs;
  }

  private getBlackRemaining(): number {
    if (this.activeColor === "b" && this.turnStartedAt !== null) {
      return Math.max(0, this.blackRemainingMs - (Date.now() - this.turnStartedAt));
    }
    return this.blackRemainingMs;
  }

  private startInterval(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      if (this.activeColor === null || this.turnStartedAt === null) return;

      const whiteRemaining = this.getWhiteRemaining();
      const blackRemaining = this.getBlackRemaining();

      if (this.activeColor === "w" && whiteRemaining <= 0) {
        this.stop();
        this.onTimeout("w");
      } else if (this.activeColor === "b" && blackRemaining <= 0) {
        this.stop();
        this.onTimeout("b");
      }
    }, 500); // Check every 500ms
  }

  destroy(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
