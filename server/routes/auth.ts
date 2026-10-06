import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { config } from "../config";
import { getDB } from "../db/schema";
import { authMiddleware } from "../middleware/auth";

interface RegisterBody {
  username: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as RegisterBody;

    if (!username || !password) {
      return reply.status(400).send({ error: "Missing required fields" });
    }
    if (password.length < 8) {
      return reply.status(400).send({ error: "Password must be at least 8 characters" });
    }
    if (username.length < 2 || username.length > 30) {
      return reply.status(400).send({ error: "Username must be 2-30 characters" });
    }

    const db = getDB();
    const existingUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    if (existingUsers.count > 0) {
      return reply.status(409).send({ error: "This app allows one account. Registration is closed." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const row = db.prepare(
        `INSERT INTO users (username, password_hash)
         SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)
         RETURNING id`
      ).get(username, passwordHash) as { id: string } | undefined;

      if (!row) {
        return reply.status(409).send({ error: "This app allows one account. Registration is closed." });
      }

      const token = app.jwt.sign({ userId: row.id, username });

      return reply.send({
        token,
        user: { id: row.id, username },
      });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint")) {
        return reply.status(409).send({ error: "Username already taken" });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const { username, password } = request.body as LoginBody;

    if (!username || !password) {
      return reply.status(400).send({ error: "Missing username or password" });
    }

    const db = getDB();
    const row = db.prepare(
      "SELECT id, username, password_hash FROM users WHERE username = ?"
    ).get(username) as { id: string; username: string; password_hash: string } | undefined;

    if (!row) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ userId: row.id, username: row.username });

    return reply.send({
      token,
      user: { id: row.id, username: row.username },
    });
  });

  app.get("/api/auth/me", { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(request.user as { id: string; username: string });
  });

  app.delete("/api/auth/account", { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDB();
    const user = request.user as { id: string; username: string; email: string };
    const result = db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    if (result.changes === 0) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send({ success: true });
  });

  app.get("/api/auth/setup-status", async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!config.AUTH_ENABLED) {
      return reply.send({ needsSetup: false, authEnabled: false });
    }

    const db = getDB();
    const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
    return reply.send({
      needsSetup: row.count === 0,
      authEnabled: true,
    });
  });
}
