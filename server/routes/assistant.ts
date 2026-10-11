import crypto from "crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { config } from "../config";
import { getDB } from "../db/schema";
import { applyAction, assistantSnapshot, BudgetError } from "../budget";

function report(reply: FastifyReply, error: unknown) {
  if (error instanceof BudgetError) return reply.code(error.status).send({ error: error.message });
  throw error;
}
export async function assistantRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    if (!config.ASSISTANT_API_TOKEN) return reply.code(503).send({ error: "Assistant access is disabled" });
    const provided = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? "";
    const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
    if (!crypto.timingSafeEqual(digest(provided), digest(config.ASSISTANT_API_TOKEN))) return reply.code(401).send({ error: "Invalid assistant credential" });
  });
  const owner = () => {
    if (!config.AUTH_ENABLED) return "default";
    const row = getDB().prepare("SELECT COUNT(*) as count, MIN(id) as id FROM users").get() as { count: number; id: string };
    if (row.count !== 1 || !row.id) throw new BudgetError(409, "Assistant access requires exactly one configured account");
    return row.id;
  };
  app.get("/api/assistant/budget", async (_request, reply) => {
    try { return assistantSnapshot(owner()); } catch (error) { return report(reply, error); }
  });
  app.post("/api/assistant/actions", async (request, reply) => {
    try { return applyAction(owner(), request.body); } catch (error) { return report(reply, error); }
  });
}
