import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { applySecurityMiddleware, getCorsOrigin } from "./middleware/security.js";
import { apiLimiter, SocketRateLimiter } from "./middleware/rateLimit.js";
import { GameManager } from "./game/GameManager.js";
import { registerGameSocket } from "./sockets/gameSocket.js";
import { registerChatSocket } from "./sockets/chatSocket.js";
import { registerWebRTCSocket } from "./sockets/webrtcSocket.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./types/socket.js";
import type { PlayerColor } from "./types/game.js";

const PORT = parseInt(process.env.PORT ?? "3001");

const app = express();
const httpServer = createServer(app);

// ─── Security ───────────────────────────────────────────────────────────────
applySecurityMiddleware(app);
app.use(express.json({ limit: "10kb" }));
app.use(apiLimiter);

// ─── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: {
    origin: getCorsOrigin(),
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e5, // 100KB max message size
});

// ─── Game State ─────────────────────────────────────────────────────────────
const rateLimiter = new SocketRateLimiter();

const gameManager = new GameManager(
  // Timeout handler
  (roomId: string, loserColor: PlayerColor) => {
    const result = gameManager.handleTimeout(roomId, loserColor);
    if (!result) return;

    const roomState = gameManager.getRoomState(roomId);
    if (!roomState) return;

    io.to(roomId).emit("game:finished", {
      result,
      chess: roomState.chess,
      clock: roomState.clock,
    });
  },
  // Clock tick handler (optional periodic clock sync)
  (_roomId: string) => {
    // Clock sync is handled via getState() on each move/request
    // We don't spam the network with clock updates every tick
  }
);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ─── Socket.IO Connection ────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  registerGameSocket(io, socket, gameManager, rateLimiter);
  registerChatSocket(io, socket, gameManager, rateLimiter);
  registerWebRTCSocket(io, socket, gameManager, rateLimiter);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} reason=${reason}`);
    rateLimiter.removeSocket(socket.id);
  });

  socket.on("error", (err) => {
    console.error(`[socket] error on ${socket.id}:`, err.message);
  });
});

// ─── 404 / Error handlers ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ───────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
  console.log(`[server] accepting connections from ${getCorsOrigin()}`);
});

export { io, gameManager };
