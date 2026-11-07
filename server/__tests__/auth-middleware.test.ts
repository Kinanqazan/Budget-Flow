import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { config } from "../config";
import { authMiddleware } from "../middleware/auth";

vi.mock("better-sqlite3", () => {
  const mockDb = {
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(() => ({ changes: 1 })),
    })),
    close: vi.fn(),
  };
  return { default: vi.fn(() => mockDb) };
});

describe("Auth Middleware", () => {
  beforeEach(() => {
    config.AUTH_ENABLED = true;
  });

  it("attaches synthetic user when AUTH_ENABLED=false", async () => {
    config.AUTH_ENABLED = false;

    const app = Fastify();
    app.get("/test", { preHandler: [authMiddleware] }, async (req) => {
      return req.user;
    });

    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("default");
    expect(body.username).toBe("admin");
  });

  it("returns 401 without token when AUTH_ENABLED=true", async () => {
    const app = Fastify();
    await app.register(jwt, { secret: "test-secret" });

    app.get("/test", { preHandler: [authMiddleware] }, async (req) => {
      return req.user;
    });

    const res = await app.inject({ method: "GET", url: "/test" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const app = Fastify();
    await app.register(jwt, { secret: "test-secret" });

    app.get("/test", { preHandler: [authMiddleware] }, async (req) => {
      return req.user;
    });

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: "Bearer invalid-token-that-wont-verify" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("passes through with valid token", async () => {
    const app = Fastify();
    await app.register(jwt, { secret: "test-secret" });

    app.get("/test", { preHandler: [authMiddleware] }, async (req) => {
      return req.user;
    });

    const token = app.jwt.sign(
      { userId: "user1", username: "alice", email: "alice@local" }
    );

    const res = await app.inject({
      method: "GET",
      url: "/test",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("user1");
    expect(body.username).toBe("alice");
  });
});