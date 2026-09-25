import helmet from "helmet";
import cors from "cors";
import type { Application } from "express";

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

export function applySecurityMiddleware(app: Application): void {
  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", CLIENT_URL],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS - only allow configured origin
  app.use(
    cors({
      origin: CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    })
  );

  // Limit request body size
  app.use((req, _res, next) => {
    if (req.headers["content-length"]) {
      const size = parseInt(req.headers["content-length"]);
      if (size > 1024 * 1024) {
        // 1MB limit
        _res.status(413).json({ error: "Payload too large" });
        return;
      }
    }
    next();
  });
}

export function getCorsOrigin(): string {
  return CLIENT_URL;
}
