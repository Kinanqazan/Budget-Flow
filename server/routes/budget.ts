import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDB } from "../db/schema";
import { authMiddleware } from "../middleware/auth";

interface SaveBody {
  finance_data: object;
  dark_mode: boolean;
  currency: string;
}

function hasMeaningfulFinanceData(fd: { income?: { value?: number }[]; categories?: unknown[] }): boolean {
  if (!fd.categories || fd.categories.length === 0) return false;
  return fd.income?.some((i) => (i.value || 0) > 0) ?? false;
}

export async function budgetRoutes(app: FastifyInstance) {
  app.get("/api/budget", { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDB();
    const user = request.user as { id: string; username: string; email: string };
    const row = db.prepare(
      "SELECT finance_data, dark_mode, currency, updated_at FROM budget_data WHERE user_id = ?"
    ).get(user.id) as { finance_data: string; dark_mode: number; currency: string; updated_at: string } | undefined;

    if (!row) {
      return reply.send({
        finance_data: null,
        dark_mode: true,
        currency: "€",
      });
    }

    const finance_data = JSON.parse(row.finance_data);
    if (!hasMeaningfulFinanceData(finance_data)) {
      return reply.send({
        finance_data: null,
        dark_mode: !!row.dark_mode,
        currency: row.currency,
        updated_at: row.updated_at,
      });
    }

    return reply.send({
      finance_data,
      dark_mode: !!row.dark_mode,
      currency: row.currency,
      updated_at: row.updated_at,
    });
  });

  app.put("/api/budget", { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { finance_data, dark_mode, currency } = request.body as SaveBody;

    if (!finance_data || typeof finance_data !== "object") {
      return reply.status(400).send({ error: "Invalid finance_data" });
    }

    const db = getDB();
    const user = request.user as { id: string; username: string; email: string };
    const json = JSON.stringify(finance_data);

    db.prepare(`
      INSERT INTO budget_data (user_id, finance_data, dark_mode, currency, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        finance_data = excluded.finance_data,
        dark_mode = excluded.dark_mode,
        currency = excluded.currency,
        updated_at = datetime('now')
    `).run(user.id, json, dark_mode ? 1 : 0, currency);

    return reply.send({ success: true });
  });
}
