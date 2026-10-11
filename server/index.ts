import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { initDB } from "./db/schema";
import { authRoutes } from "./routes/auth";
import { budgetRoutes } from "./routes/budget";
import { assistantRoutes } from "./routes/assistant";

const app = Fastify({
  logger: { level: config.LOG_LEVEL, redact: ["req.headers.authorization"] },
});

async function start() {
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  initDB();

  app.get("/api/health", async () => {
    return { status: "ok", version: "1.0.0" };
  });

  // Rate-limit auth endpoints only; budget autosave needs many requests per minute.
  await app.register(async (scoped) => {
    await scoped.register(rateLimit, {
      max: 20,
      timeWindow: "1 minute",
      keyGenerator: (request) => request.ip,
    });
    await scoped.register(authRoutes);
  });

  await app.register(budgetRoutes);
  await app.register(assistantRoutes);

  // Use cwd so Docker (node server/dist/index.js) resolves /app/dist, not /app/server/dist.
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    await app.register(fastifyStatic, {
      root: distPath,
    });

    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith("/api")) {
        return reply.sendFile("index.html");
      }
      return reply.status(404).send({ error: "Not found" });
    });
  }

  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(`Server listening on ${config.HOST}:${config.PORT}`);
}

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
