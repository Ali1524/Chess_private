import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Socket-level rate limiting (per-socket in-memory)
interface RateWindow {
  count: number;
  windowStart: number;
}

export class SocketRateLimiter {
  private windows: Map<string, Map<string, RateWindow>> = new Map();
  private readonly limits: Map<string, { max: number; windowMs: number }>;

  constructor() {
    this.limits = new Map([
      ["room:create", { max: 5, windowMs: 60_000 }],
      ["room:join", { max: 10, windowMs: 60_000 }],
      ["chat:message", { max: 30, windowMs: 30_000 }],
      ["game:move", { max: 120, windowMs: 60_000 }],
      ["game:draw:offer", { max: 5, windowMs: 60_000 }],
      ["game:resign", { max: 3, windowMs: 60_000 }],
      ["webrtc:offer", { max: 10, windowMs: 60_000 }],
      ["webrtc:answer", { max: 10, windowMs: 60_000 }],
      ["webrtc:ice-candidate", { max: 100, windowMs: 30_000 }],
    ]);

    // Cleanup stale entries periodically
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  isAllowed(socketId: string, event: string): boolean {
    const limit = this.limits.get(event);
    if (!limit) return true;

    const now = Date.now();
    if (!this.windows.has(socketId)) {
      this.windows.set(socketId, new Map());
    }

    const socketWindows = this.windows.get(socketId)!;
    const window = socketWindows.get(event);

    if (!window || now - window.windowStart > limit.windowMs) {
      socketWindows.set(event, { count: 1, windowStart: now });
      return true;
    }

    if (window.count >= limit.max) {
      return false;
    }

    window.count++;
    return true;
  }

  removeSocket(socketId: string): void {
    this.windows.delete(socketId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [socketId, events] of this.windows) {
      for (const [event, window] of events) {
        const limit = this.limits.get(event);
        if (limit && now - window.windowStart > limit.windowMs * 2) {
          events.delete(event);
        }
      }
      if (events.size === 0) {
        this.windows.delete(socketId);
      }
    }
  }
}
