import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { config } from "../config";

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

const originalAuthEnabled = config.AUTH_ENABLED;

async function buildApp(authEnabled?: boolean) {
  if (authEnabled !== undefined) {
    config.AUTH_ENABLED = authEnabled;
  }

  const { initDB } = await import("../db/schema");
  initDB();

  const app = Fastify();
  await app.register(jwt, { secret: "test-secret" });

  const { authRoutes } = await import("../routes/auth");
  await app.register(authRoutes);

  return app;
}

describe("Auth Routes", () => {
  beforeEach(() => {
    config.AUTH_ENABLED = originalAuthEnabled;
  });

  describe("POST /api/auth/register", () => {
    it("returns 400 for missing fields", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "", password: "" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for short password", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "test", password: "12" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for short username", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { username: "x", password: "Test1234" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 400 for missing credentials", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 401 for invalid credentials", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { username: "nonexistent", password: "Test1234" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/auth/setup-status", () => {
    it("returns authEnabled:false when AUTH_ENABLED=false", async () => {
      const app = await buildApp(false);
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/setup-status",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.authEnabled).toBe(false);
      expect(body.needsSetup).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 401 without token", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/auth/account", () => {
    it("returns 401 without token", async () => {
      const app = await buildApp(true);
      const res = await app.inject({
        method: "DELETE",
        url: "/api/auth/account",
      });
      expect(res.statusCode).toBe(401);
    });
  });
});