import helmet from "helmet";
import cors from "cors";
import type { Application } from "express";

const CLIENT_URLS = (process.env.CLIENT_URL ?? "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const DEFAULT_CLIENT_URL = CLIENT_URLS[0] ?? "http://localhost:5173";

export function applySecurityMiddleware(app: Application): void {
  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", ...CLIENT_URLS],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS - allow the configured frontend origins, including Vercel previews and localhost
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (CLIENT_URLS.includes(origin)) {
          callback(null, true);
          return;
        }

        if (origin.includes(".vercel.app") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
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
  return DEFAULT_CLIENT_URL;
}
