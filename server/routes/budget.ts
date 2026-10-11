import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth";
import { BudgetError, readBudget, saveBudget } from "../budget";

export async function budgetRoutes(app: FastifyInstance) {
  app.get("/api/budget", { preHandler: [authMiddleware] }, async request => readBudget((request.user as { id: string }).id));
  app.put("/api/budget", { preHandler: [authMiddleware] }, async (request, reply) => {
    try { return { success: true, ...saveBudget((request.user as { id: string }).id, request.body) }; }
    catch (error) {
      if (error instanceof BudgetError) return reply.code(error.status).send({ error: error.message });
      throw error;
    }
  });
}
